// Draft i managerkarrieren (migrering 0095). Denne fila brukes både på serveren og i nettleseren:
// plassene i laget, premietabellen og hvordan en draft blir til et lag i kampmotoren.
import { canPlayPosition, formationNames, formations, type Formation } from "./lineup";
import type { ManagerPlayerSnapshot, ManagerTeamSnapshot } from "./manager-match";
import type { SpecialKind } from "./special-cards";

/** Holdes lik draft_entry_fee() i databasen. */
export const DRAFT_ENTRY_FEE = 50;
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

/** Om et kort med `position` kan trekkes til plassen. Reservene kan være hva som helst. */
export function slotAccepts(key: string, formation: Formation, position: string): boolean {
  if (key === CAPTAIN_KEY) return formations[formation].some((slot) => canPlayPosition(position, slot.position));
  if (key.startsWith("s")) { const slot = formations[formation][Number(key.slice(1))]; return Boolean(slot) && canPlayPosition(position, slot.position); }
  if (key.startsWith("b")) return (benchPositions[Number(key.slice(1))] ?? []).some((role) => canPlayPosition(position, role));
  return RESERVE_KEYS.includes(key);
}

/** Første ledige plass i elleveren som kapteinen kan spille på. */
export function captainSlot(formation: Formation, players: Record<string, DraftPlayer>, position: string): string | null {
  return STARTER_KEYS.find((key, index) => !players[key] && canPlayPosition(position, formations[formation][index].position)) ?? null;
}

export function draftComplete(players: Record<string, DraftPlayer>): boolean {
  return ALL_SLOT_KEYS.every((key) => Boolean(players[key]));
}

export function draftRating(players: Record<string, DraftPlayer>): number | null {
  const starters = STARTER_KEYS.map((key) => players[key]).filter(Boolean);
  return starters.length ? Math.round(starters.reduce((sum, player) => sum + player.overall, 0) / starters.length) : null;
}

/** Bare det kampmotoren trenger, så kampplanen ikke blir full av attributter. */
export function toSnapshot(player: DraftPlayer): ManagerPlayerSnapshot {
  return { id: player.id, name: player.name, position: player.position, overall: player.overall, slug: player.slug ?? null, club: player.club ?? null, accent: player.accent ?? null };
}

/** Draften som lag i kampmotoren: elleveren og benken. Reservene spiller ikke. */
export function draftTeamSnapshot(userId: string, formationValue: string | null, players: Record<string, DraftPlayer>): ManagerTeamSnapshot | null {
  const formation = draftFormation(formationValue);
  if (!formation) return null;
  const starters = STARTER_KEYS.map((key) => players[key]);
  if (starters.some((player) => !player)) return null;
  const bench = BENCH_KEYS.map((key) => players[key]).filter((player): player is DraftPlayer => Boolean(player));
  return { userId, formation, starters: starters.map(toSnapshot), bench: bench.map(toSnapshot) };
}
