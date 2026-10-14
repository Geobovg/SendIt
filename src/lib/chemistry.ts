// Kjemi i managerkarrieren, inspirert av FC 25/26: ingen koblingslinjer, bare hvor mange i elleveren som
// deler klubb, liga eller nasjon. Filen brukes både av kampmotoren, serveren og nettleseren.

/** Det kjemien trenger å vite om en spiller. `ManagerPlayerSnapshot` og de fleste kortene i appen passer. */
export type ChemistryPlayer = {
  id: string;
  club?: string | null;
  league?: string | null;
  nation?: string | null;
  /** Et personlig kort (en ekte manager) har ingen klubb, liga eller nasjon. */
  personal?: boolean | null;
};

export const MAX_CHEMISTRY_PER_PLAYER = 3;
/** 11 spillere à 3 poeng. */
export const MAX_TEAM_CHEMISTRY = 11 * MAX_CHEMISTRY_PER_PLAYER;
/** Hvert kjemipoeng gir så mye effektiv rating i kampmotoren. Kortets egen rating endres aldri. */
export const RATING_PER_CHEMISTRY = 1;
/** Oppdiktede AI-klubber og AI-lagene i draft har ikke ekte kjemi, men får dette (ca. 22 av 33 poeng). */
export const AI_CHEMISTRY_RATING = 2;

/** Antall spillere som må dele det, for 1, 2 og 3 poeng. Samme tersklene som i FC. */
export const CLUB_THRESHOLDS = [2, 4, 7] as const;
export const LEAGUE_THRESHOLDS = [3, 5, 8] as const;
export const NATION_THRESHOLDS = [2, 5, 8] as const;

/** Ligaen til spillere som ikke hører til en av de store ligaene, og til ikonene (se `isIcon`). */
export const OTHER_LEAGUE = "other";
export const ICON_LEAGUE = "icons";
/** Klubber som ikke er en ekte klubb, og derfor aldri gir klubbkjemi. */
const NO_CLUB = new Set(["", "icons", "uten klubb", "ukjent klubb", "unknown club", "free agent", "academy"]);

export const isIcon = (player: ChemistryPlayer) => player.league === ICON_LEAGUE;

function pointsFor(count: number, thresholds: readonly number[]): number {
  return thresholds.reduce((points, threshold) => (count >= threshold ? points + 1 : points), 0);
}

const clubKey = (player: ChemistryPlayer) => {
  const club = player.club?.trim().toLowerCase();
  return club && !NO_CLUB.has(club) ? club : null;
};
const leagueKey = (player: ChemistryPlayer) => (player.league && player.league !== OTHER_LEAGUE && !isIcon(player) ? player.league : null);
const nationKey = (player: ChemistryPlayer) => (player.nation ? player.nation.toLowerCase() : null);

function bump(counts: Map<string, number>, key: string | null, amount = 1) {
  if (key) counts.set(key, (counts.get(key) ?? 0) + amount);
}

/**
 * Kjemien til hver spiller på banen, 0–3. Som i FC teller spilleren selv med.
 * - Klubb 2/4/7, liga 3/5/8 og nasjon 2/5/8 gir ett, to og tre poeng, og summen kappes på 3.
 * - Liga «other» og ukjente klubber gir ingenting.
 * - Et ikon har alltid 3, teller dobbelt for nasjonen sin og som én ekstra for alle ligaene på laget.
 * - Et personlig kort har alltid 3, men teller ikke for noen andre.
 */
export function chemistryOf(players: ChemistryPlayer[]): Map<string, number> {
  const clubs = new Map<string, number>();
  const leagues = new Map<string, number>();
  const nations = new Map<string, number>();
  for (const player of players) {
    if (player.personal) continue;
    bump(clubs, clubKey(player));
    bump(leagues, leagueKey(player));
    bump(nations, nationKey(player), isIcon(player) ? 2 : 1);
  }
  const icons = players.filter((player) => !player.personal && isIcon(player)).length;
  const result = new Map<string, number>();
  for (const player of players) {
    if (player.personal || isIcon(player)) { result.set(player.id, MAX_CHEMISTRY_PER_PLAYER); continue; }
    const club = clubKey(player);
    const league = leagueKey(player);
    const nation = nationKey(player);
    const points =
      (club ? pointsFor(clubs.get(club) ?? 0, CLUB_THRESHOLDS) : 0) +
      (league ? pointsFor((leagues.get(league) ?? 0) + icons, LEAGUE_THRESHOLDS) : 0) +
      (nation ? pointsFor(nations.get(nation) ?? 0, NATION_THRESHOLDS) : 0);
    result.set(player.id, Math.min(MAX_CHEMISTRY_PER_PLAYER, points));
  }
  return result;
}

/** Summen for laget, 0–33. */
export function teamChemistry(players: ChemistryPlayer[]): number {
  let total = 0;
  for (const points of chemistryOf(players).values()) total += points;
  return total;
}

export type ChemistrySource = { count: number; points: number };
export type ChemistryDetails = { points: number; club: ChemistrySource; league: ChemistrySource; nation: ChemistrySource; always: "icon" | "personal" | null };

/** Hvor kjemien til én spiller kommer fra, slik den vises i spillerdetaljene. */
export function chemistryDetails(players: ChemistryPlayer[], id: string): ChemistryDetails | null {
  const player = players.find((entry) => entry.id === id);
  if (!player) return null;
  const empty: ChemistrySource = { count: 0, points: 0 };
  if (player.personal) return { points: MAX_CHEMISTRY_PER_PLAYER, club: empty, league: empty, nation: empty, always: "personal" };
  if (isIcon(player)) return { points: MAX_CHEMISTRY_PER_PLAYER, club: empty, league: empty, nation: empty, always: "icon" };
  const others = players.filter((entry) => !entry.personal);
  const icons = others.filter(isIcon).length;
  const source = (key: string | null, same: (entry: ChemistryPlayer) => boolean, thresholds: readonly number[], extra = 0): ChemistrySource => {
    if (!key) return empty;
    const count = others.filter(same).length + extra;
    return { count, points: pointsFor(count, thresholds) };
  };
  const club = clubKey(player); const league = leagueKey(player); const nation = nationKey(player);
  const detail: ChemistryDetails = {
    points: 0,
    always: null,
    club: source(club, (entry) => clubKey(entry) === club, CLUB_THRESHOLDS),
    league: source(league, (entry) => leagueKey(entry) === league, LEAGUE_THRESHOLDS, icons),
    nation: source(nation, (entry) => nationKey(entry) === nation && !isIcon(entry), NATION_THRESHOLDS, others.filter((entry) => isIcon(entry) && nationKey(entry) === nation).length * 2),
  };
  detail.points = Math.min(MAX_CHEMISTRY_PER_PLAYER, detail.club.points + detail.league.points + detail.nation.points);
  return detail;
}

/** Et kort slik de fleste komponentene har det (`special: "personal"`), som kjemispiller. */
export function chemistryCard<T extends ChemistryPlayer & { special?: string | null }>(card: T): T {
  return card.special === "personal" ? { ...card, personal: true } : card;
}
