// Stadionet: bygninger som oppgraderes med MB og tid, som i Clash of Clans. Tallene ligger bare her; databasefunksjonene
// i migrering 0123 får kostnad, tid og produksjon fra serverkoden og passer på resten (penger, byggere, rekkefølge).
// Rene funksjoner uten database, så de kan testes (scripts/test-stadium.mjs).

export const buildingKeys = ["klubbhus", "billettluke", "tribune"] as const;
export type BuildingKey = (typeof buildingKeys)[number];

type BuildingSpec = {
  /** Nivået alle starter på. Tribunen må bygges først (nivå 0). */
  startLevel: number;
  maxLevel: number;
  /** MB for å nå nivå 1, 2, 3 … (indeks 0 er nivå 1). */
  costs: number[];
  /** Byggetid i minutter for å nå nivå 1, 2, 3 … */
  minutes: number[];
};

const H = 60;
const D = 24 * 60;

export const buildings: Record<BuildingKey, BuildingSpec> = {
  // Klubbhuset er «rådhuset»: det setter taket for de andre bygningene.
  klubbhus: { startLevel: 1, maxLevel: 5, costs: [0, 300, 1200, 3500, 8000], minutes: [0, 4 * H, D, 2 * D, 4 * D] },
  billettluke: { startLevel: 1, maxLevel: 10, costs: [0, 40, 80, 150, 250, 400, 650, 1000, 1600, 2500], minutes: [0, 10, 30, H, 3 * H, 6 * H, 12 * H, D, 2 * D, 3 * D] },
  tribune: { startLevel: 0, maxLevel: 10, costs: [60, 120, 250, 450, 750, 1200, 1900, 3000, 4500, 7000], minutes: [15, H, 2 * H, 5 * H, 10 * H, 20 * H, 36 * H, 3 * D, 4 * D, 5 * D] },
};

/** Antall byggere, altså hvor mange oppgraderinger som kan pågå samtidig. */
export const BUILDERS = 1;

/** Billettluka fylles opp til denne mange timers produksjon, så den må tømmes jevnlig. */
export const STORAGE_HOURS = 8;
/** MB per time for billettluka på nivå 1, 2, 3 … */
export const hourlyIncome = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12];
/** Hjemmebanebonusen per tribunenivå. Legges som skjult styrke på hjemmelaget (se `bonus` i manager-match.ts). */
export const HOME_BONUS_PER_LEVEL = 0.1;

export type StadiumLevels = Record<BuildingKey, number>;
/** En pågående oppgradering: bygningen når `to` når `endsAt` er passert. */
export type StadiumUpgrade = { building: BuildingKey; to: number; endsAt: Date };
export type StadiumState = { levels: StadiumLevels; upgrades: StadiumUpgrade[]; collectedAt: Date };

export const isBuildingKey = (value: unknown): value is BuildingKey => typeof value === "string" && (buildingKeys as readonly string[]).includes(value);

export function startLevels(): StadiumLevels {
  return { klubbhus: buildings.klubbhus.startLevel, billettluke: buildings.billettluke.startLevel, tribune: buildings.tribune.startLevel };
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
  if (activeUpgrades(state, now).length >= BUILDERS) return { block: "builders_busy", to };
  return { to, cost: spec.costs[to - 1], minutes: spec.minutes[to - 1], minKlubbhus };
}

/** Billettluka: MB per time og hvor mye den rommer. */
export function incomeOf(levels: StadiumLevels) {
  const perHour = hourlyIncome[levels.billettluke - 1] ?? 0;
  return { perHour, capacity: Math.floor(perHour * STORAGE_HOURS) };
}

/** MB som ligger klar i billettluka nå (hele MB, aldri mer enn kapasiteten). */
export function collectable(state: StadiumState, now: Date): number {
  const { perHour, capacity } = incomeOf(effectiveLevels(state, now));
  const hours = Math.max(0, (now.getTime() - state.collectedAt.getTime()) / 3_600_000);
  return Math.min(capacity, Math.floor(perHour * hours));
}

/** Hjemmebanebonusen i rating: 0 uten tribune. Gjelder bare laget som spiller hjemme. */
export function homeBonusOf(levels: StadiumLevels): number {
  return Math.round(levels.tribune * HOME_BONUS_PER_LEVEL * 100) / 100;
}

/** Sekunder til en oppgradering er ferdig, aldri negativt. */
export const secondsLeft = (endsAt: Date, now: Date) => Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
