import { formations } from "./lineup";
import type { ManagerPlayerSnapshot, ManagerTeamSnapshot } from "./manager-match";

/**
 * `bonus` er den skjulte styrken AI-klubbene får fra arena 2 (se arenas.ts). Eldre sesonger har den ikke.
 * Er motstanderen en annen brukers lag, har den `user_id` og `manager` (brukernavnet), og `name` er klubbnavnet.
 */
/**
 * Et lag slik det vises i lagvinduet. `kind` sier hvor ratingene kommer fra: `real` er brukerens ekte lag,
 * `scaled` er et brukerlag justert til divisjonen i AI-sesongen, og `ai` er oppdiktede spillere.
 */
export type TeamView = { name: string; subtitle: string | null; formation: string; starters: ManagerPlayerSnapshot[]; bench: ManagerPlayerSnapshot[]; kind: "real" | "scaled" | "ai" };

export type AiTeam = { key: string; name: string; rating: number; bonus?: number; user_id?: string; manager?: string };

const firstNames = ["James", "Liam", "Oliver", "Harry", "Jack", "Charlie", "Thomas", "George", "Oscar", "William", "Noah", "Ethan", "Leo", "Mason", "Lucas", "Ryan", "Callum", "Daniel", "Joe", "Kieran"];
const lastNames = ["Carter", "Walsh", "Bennett", "Hughes", "Turner", "Parker", "Collins", "Morgan", "Reid", "Foster", "Hayes", "Barnes", "Cooper", "Ward", "Fletcher", "Doyle", "Murphy", "Price", "Shaw", "Holloway"];

/** Enkel deterministisk tallgenerator, så samme AI-klubb får samme spillere hver gang. */
function seeded(seed: string) {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) | 0;
    return ((state >>> 0) % 10000) / 10000;
  };
}

/**
 * Laguttaket til en AI-klubb: 4-3-3 med oppdiktede spillere spredt rundt klubbens rating.
 * I arena 1 er hver spiller maks 95 som før, fra arena 2 kan de være opptil 99.
 */
export function aiTeamSnapshot(seasonId: string, team: AiTeam, maxOverall = 95): ManagerTeamSnapshot {
  const random = seeded(`${seasonId}:${team.key}`);
  const player = (index: number, position: string): ManagerPlayerSnapshot => ({
    id: `ai:${team.key}:${index}`,
    name: `${firstNames[Math.floor(random() * firstNames.length)]} ${lastNames[Math.floor(random() * lastNames.length)]}`,
    position,
    overall: Math.max(45, Math.min(maxOverall, team.rating + Math.round(random() * 6 - 3))),
    slug: null,
    club: team.name,
    accent: null,
  });
  const starters = formations["4-3-3"].map((slot, index) => player(index, slot.position));
  const bench = ["GK", "CB", "CM", "ST"].map((position, index) => player(11 + index, position));
  return { userId: `ai:${team.key}`, formation: "4-3-3", starters, bench, ...(team.bonus ? { bonus: team.bonus } : {}) };
}

const average = (players: ManagerPlayerSnapshot[]) => players.reduce((sum, player) => sum + player.overall, 0) / players.length;

/**
 * En annen brukers lag som motstander i sesongen: samme spillere og formasjon, men alle ratingene flyttes like mye
 * så snittet av de elleve som starter blir klubbens rating. Da er laget like vanskelig som en AI-klubb i samme
 * divisjon, uansett hvor godt laget egentlig er. Siden heter `ai:` så den byttes og venter som en AI-klubb.
 */
export function userTeamAsOpponent(source: ManagerTeamSnapshot, team: AiTeam, maxOverall = 95): ManagerTeamSnapshot {
  let shift = team.rating - average(source.starters);
  const scale = (player: ManagerPlayerSnapshot): ManagerPlayerSnapshot => ({ ...player, id: `ai:${team.key}:${player.id}`, overall: Math.max(45, Math.min(maxOverall, Math.round(player.overall + shift))) });
  // Taket og gulvet kan kutte de beste og de svakeste, så forskyvningen justeres til snittet treffer.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const missing = team.rating - average(source.starters.map(scale));
    if (Math.abs(missing) < 0.5) break;
    shift += missing;
  }
  return { userId: `ai:${team.key}`, formation: source.formation, starters: source.starters.map(scale), bench: source.bench.map(scale), ...(team.bonus ? { bonus: team.bonus } : {}) };
}
