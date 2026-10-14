// Ren draft-trekking og AI-lagbygging. Delt ut slik at hele lagbyggingen kan testes uten database.
import { BENCH_KEYS, CAPTAIN_KEY, OPTIONS_PER_PICK, slotAccepts, type DraftPlayer } from "./draft-core";
import { canPlayPosition, formationNames, formations, type Formation } from "./lineup";
import type { ManagerPlayerSnapshot, ManagerTeamSnapshot } from "./manager-match";

export type PoolCard = Omit<DraftPlayer, "id">;

// ---------------------------------------------------------------------------
// Alternativene per plass
// ---------------------------------------------------------------------------

/** Ratingbåndene for vanlige plasser, som i FC: mest solide gullkort, av og til en stjerne. */
const bands = [
  { weight: 60, min: 75, max: 80 },
  { weight: 27, min: 81, max: 84 },
  { weight: 10, min: 85, max: 87 },
  { weight: 3, min: 88, max: 99 },
];
/** Sjansen for at et alternativ er et spesialkort (inform, TOTS, icon eller honorable mention). */
const SPECIAL_CHANCE = 0.04;
const CAPTAIN_SPECIAL_CHANCE = 0.15;
const CAPTAIN_MIN = 85;

const pick = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

function rollBand() {
  let roll = Math.random() * bands.reduce((sum, band) => sum + band.weight, 0);
  for (const band of bands) { roll -= band.weight; if (roll < 0) return band; }
  return bands[0];
}

/**
 * Fem alternativer til en plass. Ingen spiller kan dukke opp to ganger i samme valg eller hvis han allerede er
 * i laget (vanlig-kortet og spesialkortet regnes som samme spiller). Er et bånd tomt for posisjonen, velges
 * fra hele posisjonen i stedet.
 */
export function drawOptions(pool: { normal: PoolCard[]; special: PoolCard[] }, key: string, formation: Formation, taken: Set<string>): DraftPlayer[] {
  const used = new Set(taken);
  const captain = key === CAPTAIN_KEY;
  const fits = (card: PoolCard) => !used.has(card.catalogId) && slotAccepts(key, formation, card.position);
  const options: DraftPlayer[] = [];
  for (let index = 0; index < OPTIONS_PER_PICK; index += 1) {
    let chosen: PoolCard | undefined;
    if (Math.random() < (captain ? CAPTAIN_SPECIAL_CHANCE : SPECIAL_CHANCE)) chosen = pick(pool.special.filter((card) => fits(card) && (!captain || card.overall >= CAPTAIN_MIN)));
    if (!chosen) {
      const band = captain ? { min: CAPTAIN_MIN, max: 99 } : rollBand();
      chosen = pick(pool.normal.filter((card) => fits(card) && card.overall >= band.min && card.overall <= band.max))
        ?? pick(pool.normal.filter((card) => fits(card) && card.overall >= 75))
        ?? pick(pool.normal.filter(fits));
    }
    if (!chosen) break;
    used.add(chosen.catalogId);
    options.push({ ...chosen, id: crypto.randomUUID() });
  }
  return options;
}

// ---------------------------------------------------------------------------
// AI-lagene
// ---------------------------------------------------------------------------

export type DraftAiSide = { name: string; rating: number; team: ManagerTeamSnapshot };

const aiNames = ["Nordlys FC", "Atlético Fjord", "Real Sentrum", "Sporting Vika", "Dynamo Polar", "Inter Bryggen", "Olympique Kai", "Racing Tind", "AC Midnattsol", "Union Havbris", "Celtic Fyrlykt", "Rapid Skog", "Borussia Bølge", "Galaxy Isbre", "Athletic Nordkapp", "Lokomotiv Vidde", "Deportivo Fossen", "Ajax Odden", "Benfica Brygge", "Partizan Lyng"];

/**
 * Et AI-lag av ekte spillere fra katalogen, med en snittrating rundt `target`. Laget får en tilfeldig formasjon
 * og en full benk, og navnet er oppdiktet.
 */
export function aiDraftTeam(pool: { normal: PoolCard[] }, target: number, usedNames: Set<string>): DraftAiSide {
  const key = crypto.randomUUID().slice(0, 8);
  const formation = pick(formationNames) ?? "4-3-3";
  const used = new Set<string>();
  const pickNear = (accepts: (position: string) => boolean, base: number) => {
    // Hver spiller siktes litt over eller under snittet, så lagene får både stjerner og svakere ledd.
    const aim = base + Math.floor(Math.random() * 7) - 3;
    const fits = (card: PoolCard, spread: number) => !used.has(card.catalogId) && accepts(card.position) && Math.abs(card.overall - aim) <= spread;
    const card = pick(pool.normal.filter((entry) => fits(entry, 2))) ?? pick(pool.normal.filter((entry) => fits(entry, 5))) ?? pick(pool.normal.filter((entry) => fits(entry, 99)));
    if (card) used.add(card.catalogId);
    return card;
  };
  const toPlayer = (card: PoolCard, index: number): ManagerPlayerSnapshot => ({ id: `ai:${key}:${index}`, name: card.name, position: card.position, overall: card.overall, slug: card.slug ?? null, club: card.club ?? null, accent: card.accent ?? null });
  const starters = formations[formation].map((slot) => pickNear((position) => canPlayPosition(position, slot.position), target)).filter((card): card is PoolCard => Boolean(card));
  if (starters.length !== 11) throw new Error("Draft AI team needs eleven players in valid positions");
  const bench = BENCH_KEYS.map((benchKey) => pickNear((position) => slotAccepts(benchKey, formation, position), target - 2)).filter((card): card is PoolCard => Boolean(card));
  const free = aiNames.filter((name) => !usedNames.has(name));
  const name = pick(free.length ? free : aiNames)!;
  usedNames.add(name);
  const team: ManagerTeamSnapshot = { userId: `ai:draft:${key}`, formation, starters: starters.map(toPlayer), bench: bench.map((card, index) => toPlayer(card, 11 + index)) };
  const rating = Math.round(team.starters.reduce((sum, player) => sum + player.overall, 0) / Math.max(1, team.starters.length));
  return { name, rating, team };
}

/** Motstanderne i solo blir bedre for hver runde, målt mot ditt eget lag, med litt tilfeldig variasjon fra kamp til kamp. */
const soloOffsets = [-4, -3, -1, 0, 2];
export function soloOpponentRating(ownRating: number, round: number) {
  const variation = Math.floor(Math.random() * 7) - 3;
  return Math.max(55, Math.min(95, ownRating + (soloOffsets[round - 1] ?? 0) + variation));
}
