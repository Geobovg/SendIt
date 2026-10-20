// Arenaene i AI-sesongen. Hver arena har ti divisjoner, så stigen er 50 nivåer lang.
// Tallene speiles i SQL-funksjonene i migrering 0062 (ai_team_offsets, ai_arena_factor og finish_ai_season)
// og 0108 (ai_division_rating, ai_team_offsets og ai_arena_bonus). Endres ett sted, må det andre følge.

export type ArenaNumber = 1 | 2 | 3 | 4 | 5;

export type Arena = {
  number: ArenaNumber;
  /** Ekte stadionnavn. De oversettes ikke. */
  name: string;
  /** Fargetemaet på sesong- og kampskjermen: hovedfarge, glød og mørk bunn. */
  colors: { primary: string; glow: string; base: string };
  /** AI-ratingen i divisjon 10 og divisjon 1. Divisjonene imellom fordeles jevnt. */
  rating: { bottom: number; top: number };
  /** Avvik fra divisjonsratingen for de fem AI-klubbene. Jevnere jo høyere arena. */
  offsets: [number, number, number, number, number];
  /** Skjult styrke i kampmodellen. Vises ikke som rating. */
  bonus: number;
  /** Opprykkspremien og klubb-XP ganges med denne. */
  factor: number;
  /** Inform-sjansen i vanlige pakker ganges med denne. */
  informFactor: number;
};

export const arenas: Arena[] = [
  { number: 1, name: "Gamle Gress", colors: { primary: "#98ff2c", glow: "rgba(152,255,44,.18)", base: "#07111a" }, rating: { bottom: 58, top: 80 }, offsets: [-2, -1, 0, 1, 3], bonus: 0, factor: 1, informFactor: 1 },
  { number: 2, name: "Ullevaal", colors: { primary: "#ff4d5e", glow: "rgba(255,77,94,.2)", base: "#140a10" }, rating: { bottom: 76, top: 81 }, offsets: [-2, -1, 0, 1, 2], bonus: 0, factor: 1.5, informFactor: 1.05 },
  { number: 3, name: "Wembley Stadium", colors: { primary: "#5cc8ff", glow: "rgba(92,200,255,.2)", base: "#07101c" }, rating: { bottom: 77, top: 82 }, offsets: [-1, 0, 0, 1, 2], bonus: 1, factor: 2, informFactor: 1.1 },
  { number: 4, name: "Old Trafford", colors: { primary: "#ff2b2b", glow: "rgba(255,43,43,.22)", base: "#160707" }, rating: { bottom: 79, top: 84 }, offsets: [-1, 0, 0, 1, 2], bonus: 1, factor: 2.5, informFactor: 1.15 },
  { number: 5, name: "Camp Nou", colors: { primary: "#f2c94c", glow: "rgba(242,201,76,.22)", base: "#0b0a1c" }, rating: { bottom: 81, top: 86 }, offsets: [-1, 0, 0, 1, 2], bonus: 1, factor: 3, informFactor: 1.25 },
];

export const lastArena = arenas.length as ArenaNumber;

/** Navn og farger i univers 2: samme stige og samme vanskelighet, men nye stadioner. Tallene er de samme som i `arenas`. */
const secondUniverse: { name: string; colors: Arena["colors"] }[] = [
  { name: "Bislett Stadion", colors: { primary: "#ff9f1c", glow: "rgba(255,159,28,.2)", base: "#150e06" } },
  { name: "San Siro", colors: { primary: "#c77dff", glow: "rgba(199,125,255,.2)", base: "#0e0916" } },
  { name: "Allianz Arena", colors: { primary: "#2ec4b6", glow: "rgba(46,196,182,.2)", base: "#06121a" } },
  { name: "Santiago Bernabéu", colors: { primary: "#e9ecef", glow: "rgba(233,236,239,.18)", base: "#0f1117" } },
  { name: "Maracanã", colors: { primary: "#00e676", glow: "rgba(0,230,118,.22)", base: "#04140c" } },
];

/** Arenaene i et univers. Univers 1 har de opprinnelige, univers 2 de nye, og deretter går det på rundgang. */
export function arenasOf(universe: number): Arena[] {
  if (universe % 2 === 1) return arenas;
  return arenas.map((arena, index) => ({ ...arena, ...secondUniverse[index] }));
}

export function arenaOf(number: number, universe = 1): Arena {
  const set = arenasOf(universe);
  return set[Math.min(Math.max(Math.round(number), 1), set.length) - 1];
}

/** AI-ratingen for en divisjon i en arena: jevnt fordelt fra divisjon 10 til divisjon 1. */
export function divisionRating(arena: number, division: number): number {
  const { rating } = arenaOf(arena);
  return rating.bottom + Math.round(((rating.top - rating.bottom) * (10 - division)) / 9);
}

/** AI-spillerne i arena 1 er maks 95 som før. Fra arena 2 kan de være opptil 99. */
export const aiPlayerMaxOverall = (arena: number) => (arena <= 1 ? 95 : 99);
