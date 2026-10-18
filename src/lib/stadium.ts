// Stadionet: bygninger som oppgraderes med MB og tid, som i Clash of Clans. Alle starter likt, uansett arena, divisjon
// og klubbnivå. Tallene ligger bare her; databasefunksjonene i migrering 0123 får kostnad, tid og produksjon fra
// serverkoden og passer på resten (penger, byggere, rekkefølge). Rene funksjoner uten database, så de kan testes
// (scripts/test-stadium.mjs).

export const buildingKeys = ["klubbhus", "billettluke", "kasse", "treningsfelt", "tribune", "supporterfelt", "speiderhytte"] as const;
export type BuildingKey = (typeof buildingKeys)[number];

type BuildingSpec = {
  /** Nivået alle starter på. De fleste bygningene må bygges først (nivå 0). */
  startLevel: number;
  maxLevel: number;
  /** MB for å nå nivå 1, 2, 3 … (indeks 0 er nivå 1). */
  costs: number[];
  /** Byggetid i minutter for å nå nivå 1, 2, 3 …, før dugnaden fra supporterfeltet. */
  minutes: number[];
};

const H = 60;
const D = 24 * 60;

export const buildings: Record<BuildingKey, BuildingSpec> = {
  // Klubbhuset er «rådhuset»: det setter taket for de andre bygningene og gir flere byggere.
  klubbhus: { startLevel: 1, maxLevel: 5, costs: [0, 300, 1200, 3500, 8000], minutes: [0, 4 * H, D, 2 * D, 4 * D] },
  // Billettluka er gruva: den lager MB hele tiden. Kassa er lageret som bestemmer hvor lenge den kan fylle seg opp.
  billettluke: { startLevel: 1, maxLevel: 10, costs: [0, 40, 80, 150, 250, 400, 650, 1000, 1600, 2500], minutes: [0, 10, 30, H, 3 * H, 6 * H, 12 * H, D, 2 * D, 3 * D] },
  kasse: { startLevel: 1, maxLevel: 10, costs: [0, 60, 120, 220, 380, 600, 950, 1500, 2300, 3500], minutes: [0, 15, 45, 2 * H, 5 * H, 10 * H, 20 * H, 36 * H, 3 * D, 4 * D] },
  // Treningsfeltet gir klubb-XP på samme måte som billettluka gir MB.
  treningsfelt: { startLevel: 0, maxLevel: 10, costs: [80, 150, 300, 500, 800, 1300, 2000, 3200, 5000, 7500], minutes: [20, H, 3 * H, 6 * H, 12 * H, D, 2 * D, 3 * D, 4 * D, 5 * D] },
  // Tribunen gir prosent mer fra billettluka.
  tribune: { startLevel: 0, maxLevel: 10, costs: [60, 120, 250, 450, 750, 1200, 1900, 3000, 4500, 7000], minutes: [15, H, 2 * H, 5 * H, 10 * H, 20 * H, 36 * H, 3 * D, 4 * D, 5 * D] },
  // Supporterfeltet gjør at alle oppgraderinger går raskere (dugnad).
  supporterfelt: { startLevel: 0, maxLevel: 10, costs: [100, 200, 350, 600, 1000, 1600, 2500, 4000, 6000, 9000], minutes: [30, 2 * H, 4 * H, 8 * H, 16 * H, 30 * H, 2 * D, 3 * D, 4 * D, 5 * D] },
  // Speiderhytta sender ut en speider som kommer hjem med en pakke eller en spiller du kan kjøpe.
  speiderhytte: { startLevel: 0, maxLevel: 10, costs: [150, 300, 550, 900, 1400, 2200, 3400, 5200, 7500, 10000], minutes: [H, 3 * H, 6 * H, 12 * H, D, 36 * H, 2 * D, 3 * D, 4 * D, 5 * D] },
};

/** Antall byggere, altså hvor mange oppgraderinger som kan pågå samtidig: 1 til klubbhus 2, 2 til klubbhus 4, og 3 på klubbhus 5. */
export const buildersFor = (levels: StadiumLevels) => (levels.klubbhus >= 5 ? 3 : levels.klubbhus >= 3 ? 2 : 1);

/** Timer med produksjon kassa rommer, per kassenivå. Gjelder både billettluka og treningsfeltet. */
export const storageHours = [6, 8, 10, 12, 16, 20, 24, 30, 36, 48];
/** MB per time for billettluka på nivå 1, 2, 3 … før tillegget fra tribunen. */
export const hourlyIncome = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12];
/** Klubb-XP per time for treningsfeltet på nivå 1, 2, 3 … */
export const hourlyXp = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
/** Tribunen gir så mye mer fra billettluka per nivå (0,04 = 4 %). */
export const TRIBUNE_BONUS_PER_LEVEL = 0.04;
/** Supporterfeltet kutter så mye av byggetiden per nivå (0,02 = 2 %). */
export const DUGNAD_PER_LEVEL = 0.02;

/** Hurtigbygging: MB per time som er igjen, og hvor lite som skal til for at det er gratis (som i Clash). */
export const SPEEDUP_MB_PER_HOUR = 20;
export const FREE_FINISH_SECONDS = 300;

/** En speider er ute så lenge, uansett nivå. Nivået avgjør hva han kommer hjem med. */
export const SCOUT_HOURS = 24;
/** Spilleren speideren finner koster så stor del av kortverdien. Hurtigsalg gir 25 %, så det er ikke noe å tjene på å kjøpe og selge. */
export const SCOUT_PRICE_FACTOR = 0.6;
const scoutRatings: [number, number][] = [[87, 87], [87, 88], [87, 88], [88, 89], [88, 89], [89, 90], [89, 91], [90, 92], [91, 93], [92, 94]];
const scoutPacks = ["premium_gull", "premium_gull", "sjeldne_spillere", "sjeldne_spillere", "jumbo_premium_gull", "jumbo_premium_gull", "stjerneutvalg", "stjerneutvalg", "formpakka", "formpakka"];

export type StadiumLevels = Record<BuildingKey, number>;
/** En pågående oppgradering: bygningen når `to` når `endsAt` er passert. */
export type StadiumUpgrade = { building: BuildingKey; to: number; startedAt: Date; endsAt: Date };
export type ScoutPlayer = { catalogId: string; slug: string; name: string; position: string; overall: number; club: string; accent: string; attributes: Record<string, number>; price: number };
/** Det speideren kom hjem med. Spilleren mangler hvis manageren eier alle som passer. */
export type ScoutOffer = { player: ScoutPlayer | null; packKey: string };
export type StadiumScout = { level: number; startedAt: Date; endsAt: Date; offer: ScoutOffer | null };
export type Collector = "mb" | "xp";
export type StadiumState = { levels: StadiumLevels; upgrades: StadiumUpgrade[]; collectedAt: Date; xpCollectedAt: Date; scout: StadiumScout | null };

export const isBuildingKey = (value: unknown): value is BuildingKey => typeof value === "string" && (buildingKeys as readonly string[]).includes(value);

export function startLevels(): StadiumLevels {
  return Object.fromEntries(buildingKeys.map((key) => [key, buildings[key].startLevel])) as StadiumLevels;
}

/** Nivåene slik de er nå: ferdige oppgraderinger regnes som utført, også før databasen har ryddet opp. */
export function effectiveLevels(state: StadiumState, now: Date): StadiumLevels {
  const levels = { ...state.levels };
  for (const upgrade of state.upgrades) if (upgrade.endsAt.getTime() <= now.getTime() && upgrade.to > levels[upgrade.building]) levels[upgrade.building] = upgrade.to;
  return levels;
}

export const activeUpgrades = (state: StadiumState, now: Date) => state.upgrades.filter((upgrade) => upgrade.endsAt.getTime() > now.getTime());

/** Høyeste nivå en bygning kan få nå: klubbhuset setter taket for de andre (2 nivåer per klubbhusnivå). */
export function levelCap(building: BuildingKey, levels: StadiumLevels): number {
  const spec = buildings[building];
  return building === "klubbhus" ? spec.maxLevel : Math.min(spec.maxLevel, levels.klubbhus * 2);
}

/** Byggetiden i minutter etter dugnaden fra supporterfeltet. */
export const buildMinutes = (base: number, levels: StadiumLevels) => Math.max(1, Math.round(base * (1 - DUGNAD_PER_LEVEL * levels.supporterfelt)));

export type UpgradeBlock = "max_level" | "klubbhus_low" | "busy" | "builders_busy";
export type UpgradePlan = { to: number; cost: number; minutes: number; minKlubbhus: number } | { block: UpgradeBlock; to?: number; minKlubbhus?: number };

/** Hva neste oppgradering av en bygning koster, eller hvorfor den ikke kan startes nå. Pengene sjekkes av databasen. */
export function planUpgrade(state: StadiumState, building: BuildingKey, now: Date): UpgradePlan {
  const levels = effectiveLevels(state, now);
  const spec = buildings[building];
  const to = levels[building] + 1;
  if (state.upgrades.some((upgrade) => upgrade.building === building && upgrade.endsAt.getTime() > now.getTime())) return { block: "busy" };
  if (to > spec.maxLevel) return { block: "max_level" };
  const minKlubbhus = building === "klubbhus" ? 1 : Math.ceil(to / 2);
  if (to > levelCap(building, levels)) return { block: "klubbhus_low", to, minKlubbhus };
  if (activeUpgrades(state, now).length >= buildersFor(levels)) return { block: "builders_busy", to };
  return { to, cost: spec.costs[to - 1], minutes: buildMinutes(spec.minutes[to - 1], levels), minKlubbhus };
}

/** MB det koster å gjøre en pågående oppgradering ferdig nå. Gratis de siste minuttene. */
export function speedupCost(secondsRemaining: number): number {
  if (secondsRemaining <= FREE_FINISH_SECONDS) return 0;
  return Math.ceil((secondsRemaining / 3600) * SPEEDUP_MB_PER_HOUR);
}

/** Billettluka: MB per time (med tribunen) og hvor mye den rommer. */
export function incomeOf(levels: StadiumLevels) {
  const base = hourlyIncome[levels.billettluke - 1] ?? 0;
  const perHour = Math.round(base * (1 + TRIBUNE_BONUS_PER_LEVEL * levels.tribune) * 100) / 100;
  return { perHour, capacity: Math.floor(perHour * (storageHours[levels.kasse - 1] ?? 0)) };
}

/** Treningsfeltet: klubb-XP per time og hvor mye det rommer. Ingenting før det er bygd. */
export function xpOf(levels: StadiumLevels) {
  const perHour = hourlyXp[levels.treningsfelt - 1] ?? 0;
  return { perHour, capacity: Math.floor(perHour * (storageHours[levels.kasse - 1] ?? 0)) };
}

export const rateOf = (levels: StadiumLevels, collector: Collector) => (collector === "mb" ? incomeOf(levels) : xpOf(levels));

/** Det som ligger klart i billettluka eller treningsfeltet nå (hele tall, aldri mer enn kapasiteten). */
export function collectable(state: StadiumState, now: Date, collector: Collector = "mb"): number {
  const { perHour, capacity } = rateOf(effectiveLevels(state, now), collector);
  const since = collector === "mb" ? state.collectedAt : state.xpCollectedAt;
  const hours = Math.max(0, (now.getTime() - since.getTime()) / 3_600_000);
  return Math.min(capacity, Math.floor(perHour * hours));
}

/** Hva en speider på dette nivået kommer hjem med: rating på spilleren og hvilken pakke. Null uten speiderhytte. */
export function scoutReward(level: number): { minOverall: number; maxOverall: number; packKey: string } | null {
  if (level < 1) return null;
  const index = Math.min(level, buildings.speiderhytte.maxLevel) - 1;
  return { minOverall: scoutRatings[index][0], maxOverall: scoutRatings[index][1], packKey: scoutPacks[index] };
}

/** Prisen på spilleren speideren fant, ut fra katalogprisen. */
export const scoutPrice = (catalogPrice: number) => Math.max(1, Math.round(catalogPrice * SCOUT_PRICE_FACTOR));

export type ScoutStatus = "none" | "away" | "back" | "offer";
export function scoutStatus(state: StadiumState, now: Date): ScoutStatus {
  if (!state.scout) return "none";
  if (state.scout.endsAt.getTime() > now.getTime()) return "away";
  return state.scout.offer ? "offer" : "back";
}

/** Sekunder til en oppgradering er ferdig, aldri negativt. */
export const secondsLeft = (endsAt: Date, now: Date) => Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));

/** Tilstanden slik den sendes fra serveren til siden: datoer som tekst. */
export type StadiumPanelState = {
  levels: StadiumLevels;
  collectedAt: string;
  xpCollectedAt: string;
  upgrades: { building: BuildingKey; to: number; startedAt: string; endsAt: string }[];
  scout: { level: number; startedAt: string; endsAt: string; offer: ScoutOffer | null } | null;
};

export function serializeState(state: StadiumState): StadiumPanelState {
  return {
    levels: state.levels,
    collectedAt: state.collectedAt.toISOString(),
    xpCollectedAt: state.xpCollectedAt.toISOString(),
    upgrades: state.upgrades.map((upgrade) => ({ building: upgrade.building, to: upgrade.to, startedAt: upgrade.startedAt.toISOString(), endsAt: upgrade.endsAt.toISOString() })),
    scout: state.scout ? { level: state.scout.level, startedAt: state.scout.startedAt.toISOString(), endsAt: state.scout.endsAt.toISOString(), offer: state.scout.offer } : null,
  };
}

export function parseState(state: StadiumPanelState): StadiumState {
  return {
    levels: state.levels,
    collectedAt: new Date(state.collectedAt),
    xpCollectedAt: new Date(state.xpCollectedAt),
    upgrades: state.upgrades.map((upgrade) => ({ building: upgrade.building, to: upgrade.to, startedAt: new Date(upgrade.startedAt), endsAt: new Date(upgrade.endsAt) })),
    scout: state.scout ? { level: state.scout.level, startedAt: new Date(state.scout.startedAt), endsAt: new Date(state.scout.endsAt), offer: state.scout.offer } : null,
  };
}
