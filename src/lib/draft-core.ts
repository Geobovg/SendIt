// Draft i managerkarrieren (migrering 0095). Denne fila brukes både på serveren og i nettleseren:
// plassene i laget, premietabellen og hvordan en draft blir til et lag i kampmotoren.
import { chemistryOf, teamChemistry } from "./chemistry";
import { cardCanPlay, formationNames, formations, pickBestLineupWithChemistry, positionInSlot, rearrangeLineup, type Formation } from "./lineup";
import type { ManagerPlayerSnapshot, ManagerTeamSnapshot } from "./manager-match";
import type { SpecialKind } from "./special-cards";

/** Holdes lik draft_entry_fee() i databasen. */
export const DRAFT_ENTRY_FEE = 150;
/** Solo: fem runder mot AI. Venneturnering: åtte lag, tre runder. */
export const SOLO_ROUNDS = 5;
export const ROOM_ROUNDS = 3;
export const ROOM_SIZE = 8;
/** Som i vennesesongen betyr ratingen mer enn i vanlige kamper, så et godt draftet lag lønner seg. */
export const DRAFT_RATING_WEIGHT = 2;
export const OPTIONS_PER_PICK = 5;

export type DraftRewardPack = { key: string; quantity: number };
export type DraftReward = { mb: number; packs: DraftRewardPack[]; tokens: number };
export type DraftRewardOption = DraftReward & { id: string; mode: "solo" | "room"; wins: number; value: number };

/** Gamle drafts med én pakke beholdes, nye bruker hele kombinasjonen. */
export function draftReward(mb: number | null, packs: DraftRewardPack[] | null, legacyPack: string | null, tokens: number): DraftReward {
  return { mb: mb ?? 0, packs: packs ?? (legacyPack ? [{ key: legacyPack, quantity: 1 }] : []), tokens };
}

export type DraftPlayer = ManagerPlayerSnapshot & { catalogId: string; attributes: Record<string, number>; special: SpecialKind | null };
export type DraftStatus = "drafting" | "active" | "eliminated" | "champion" | "cancelled";

export const STARTER_KEYS = Array.from({ length: 11 }, (_, index) => `s${index}`);
export const BENCH_KEYS = Array.from({ length: 7 }, (_, index) => `b${index}`);
export const RESERVE_KEYS = Array.from({ length: 5 }, (_, index) => `r${index}`);
export const ALL_SLOT_KEYS = [...STARTER_KEYS, ...BENCH_KEYS, ...RESERVE_KEYS];
export const CAPTAIN_KEY = "captain";

const outfield = ["RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];
/** Benken har faste roller, som i FC: keeper, midtstopper, back, midtbane, kant, spiss og en fri utespiller. */
const benchPositions: string[][] = [["GK"], ["CB"], ["LB", "RB"], ["CDM", "CM", "CAM"], ["LW", "RW"], ["ST"], outfield];

export function draftFormation(value: string | null | undefined): Formation | null {
  return value && formationNames.includes(value as Formation) ? (value as Formation) : null;
}

/** Posisjonen plassen viser: for elleveren plassen i formasjonen, ellers rollen på benken. */
export function slotLabel(key: string, formation: Formation): string | null {
  if (key.startsWith("s")) return formations[formation][Number(key.slice(1))]?.position ?? null;
  if (key.startsWith("b")) { const allowed = benchPositions[Number(key.slice(1))]; return allowed && allowed.length <= 3 ? allowed.join("/") : null; }
  return null;
}

/** Det plasseringen ser på: hovedposisjonen og de alternative (migrering 0109). */
export type PositionedCard = { position: string; altPositions?: readonly string[] };
const asCard = (card: string | PositionedCard): PositionedCard => (typeof card === "string" ? { position: card } : card);

/** Om kortet kan trekkes til plassen. Reservene kan være hva som helst. */
export function slotAccepts(key: string, formation: Formation, cardOrPosition: string | PositionedCard): boolean {
  const card = asCard(cardOrPosition);
  if (key === CAPTAIN_KEY) return formations[formation].some((slot) => cardCanPlay(card, slot.position));
  if (key.startsWith("s")) { const slot = formations[formation][Number(key.slice(1))]; return Boolean(slot) && cardCanPlay(card, slot.position); }
  if (key.startsWith("b")) return (benchPositions[Number(key.slice(1))] ?? []).some((role) => cardCanPlay(card, role));
  return RESERVE_KEYS.includes(key);
}

/** Første ledige plass i elleveren som kapteinen kan spille på. */
export function captainSlot(formation: Formation, players: Record<string, DraftPlayer>, cardOrPosition: string | PositionedCard): string | null {
  const card = asCard(cardOrPosition);
  return STARTER_KEYS.find((key, index) => !players[key] && cardCanPlay(card, formations[formation][index].position)) ?? null;
}

export function draftComplete(players: Record<string, DraftPlayer>): boolean {
  return ALL_SLOT_KEYS.every((key) => Boolean(players[key]));
}

export function draftRating(players: Record<string, DraftPlayer>): number | null {
  const starters = STARTER_KEYS.map((key) => players[key]).filter(Boolean);
  return starters.length ? Math.round(starters.reduce((sum, player) => sum + player.overall, 0) / starters.length) : null;
}

/** Kjemien til elleveren slik den står nå (0–33). Benk og reserver teller ikke. */
export function draftChemistry(players: Record<string, DraftPlayer>): number {
  return teamChemistry(STARTER_KEYS.flatMap((key) => (players[key] ? [players[key]] : [])));
}

/** Kjemien hver spiller i elleveren har nå, på plassnøkkel. */
export function draftChemistryByKey(players: Record<string, DraftPlayer>): Record<string, number> {
  const starters = STARTER_KEYS.flatMap((key) => (players[key] ? [players[key]] : []));
  const points = chemistryOf(starters);
  return Object.fromEntries(STARTER_KEYS.flatMap((key) => (players[key] ? [[key, points.get(players[key].id) ?? 0] as const] : [])));
}

/**
 * Hvor mange kjemipoeng laget får om `candidate` settes på plassen (eller som kaptein): hans egen kjemi pluss det
 * han gir de andre. null for benk og reserver, som ikke teller.
 */
export function draftChemistryGain(players: Record<string, DraftPlayer>, formation: Formation, key: string, candidate: DraftPlayer): number | null {
  const target = key === CAPTAIN_KEY ? captainSlot(formation, players, candidate) : STARTER_KEYS.includes(key) ? key : null;
  if (!target) return null;
  return draftChemistry({ ...players, [target]: candidate }) - draftChemistry(Object.fromEntries(Object.entries(players).filter(([slot]) => slot !== target)));
}

/** Bare det kampmotoren trenger, så kampplanen ikke blir full av attributter. */
export function toSnapshot(player: DraftPlayer): ManagerPlayerSnapshot {
  return { id: player.id, name: player.name, position: player.position, ...(player.altPositions?.length ? { altPositions: player.altPositions } : {}), overall: player.overall, slug: player.slug ?? null, club: player.club ?? null, accent: player.accent ?? null, league: player.league ?? null, nation: player.nation ?? null };
}

/** Draften som lag i kampmotoren: elleveren og benken. Reservene spiller ikke. */
export function draftTeamSnapshot(userId: string, formationValue: string | null, players: Record<string, DraftPlayer>): ManagerTeamSnapshot | null {
  const formation = draftFormation(formationValue);
  if (!formation) return null;
  const starters = STARTER_KEYS.map((key, index) => players[key] && positionInSlot(players[key], formations[formation][index].position));
  if (starters.some((player) => !player)) return null;
  const bench = BENCH_KEYS.map((key) => players[key]).filter((player): player is DraftPlayer => Boolean(player));
  return { userId, formation, starters: starters.map(toSnapshot), bench: bench.map(toSnapshot) };
}

// ---------------------------------------------------------------------------
// Laget mellom kampene: bare elleveren har posisjonskrav, som i vanlig tropp
// ---------------------------------------------------------------------------

/** Hvem som står på feil plass i elleveren (for en spiller som ikke kan spille posisjonen plassen har). */
export function outOfPosition(players: Record<string, DraftPlayer>, formation: Formation): { player: DraftPlayer; position: string } | null {
  for (const [index, key] of STARTER_KEYS.entries()) {
    const player = players[key];
    const position = formations[formation][index].position;
    if (player && !cardCanPlay(player, position)) return { player, position };
  }
  return null;
}

/** Hvorfor to plasser ikke kan bytte, eller null. Benken og reservene kan ha hvem som helst, bare elleveren krever posisjon. */
export function swapBlocker(players: Record<string, DraftPlayer>, formation: Formation, first: string, second: string): { player: DraftPlayer; position: string } | null {
  const next = { ...players, [first]: players[second], [second]: players[first] };
  return outOfPosition(next, formation);
}

/** Legger spillerne på plassene: elleveren i formasjonens rekkefølge, så benken, så reservene. */
function layout(starters: DraftPlayer[], rest: DraftPlayer[]): Record<string, DraftPlayer> {
  const players: Record<string, DraftPlayer> = {};
  starters.forEach((player, index) => { players[STARTER_KEYS[index]] = player; });
  [...BENCH_KEYS, ...RESERVE_KEYS].forEach((key, index) => { if (rest[index]) players[key] = rest[index]; });
  return players;
}

function inLayout(players: Record<string, DraftPlayer>, ids: string[]): DraftPlayer[] {
  const byId = new Map(Object.values(players).map((player) => [player.id, player]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/**
 * «Velg beste tropp» i draft: den beste elleveren blant alle spillerne dine (rating pluss kjemi, og alle på sin posisjon),
 * så de beste på benken med en keeper blant dem, og resten som reserver. null hvis elleveren ikke kan fylles i posisjon.
 */
export function bestDraftLayout(players: Record<string, DraftPlayer>, formation: Formation): Record<string, DraftPlayer> | null {
  const all = Object.values(players);
  if (all.length !== ALL_SLOT_KEYS.length) return null;
  const { starters: starterIds } = pickBestLineupWithChemistry(all, formation);
  const starters = inLayout(players, starterIds);
  const chosen = new Set(starterIds);
  const rest = all.filter((player) => !chosen.has(player.id)).sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  // Benken skal ha en reservekeeper hvis laget har en: den beste keeperen tar plassen til den svakeste på benken.
  const keeper = rest.findIndex((player) => player.position === "GK");
  if (keeper >= BENCH_KEYS.length) rest.splice(BENCH_KEYS.length - 1, 0, ...rest.splice(keeper, 1));
  const next = layout(starters, rest);
  return starters.length === STARTER_KEYS.length && !outOfPosition(next, formation) ? next : null;
}

/**
 * Laget i en annen formasjon: spillerne som starter nå får beholde plassen i elleveren så langt de passer,
 * resten fylles med de beste. null hvis laget ikke har spillere til alle posisjonene i formasjonen.
 */
export function formationDraftLayout(players: Record<string, DraftPlayer>, formation: Formation): Record<string, DraftPlayer> | null {
  const all = Object.values(players);
  if (all.length !== ALL_SLOT_KEYS.length) return null;
  const ids = (keys: string[]) => keys.flatMap((key) => (players[key] ? [players[key].id] : []));
  const { starters: starterIds, bench: benchIds } = rearrangeLineup(all, formation, ids(STARTER_KEYS), ids(BENCH_KEYS));
  const starters = inLayout(players, starterIds);
  const placed = new Set(starterIds);
  const rest = [...inLayout(players, benchIds), ...all.filter((player) => !placed.has(player.id) && !benchIds.includes(player.id))];
  const next = layout(starters, rest);
  return starters.length === STARTER_KEYS.length && !outOfPosition(next, formation) ? next : null;
}
