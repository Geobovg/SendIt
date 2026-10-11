import type { QuizFormat, QuizKind } from "./types";

// Statistikken lagres bare på denne enheten, siden quizen virker uten konto og uten nett.
// localStorage kan mangle (privat modus, blokkerte data), så alt tåler at lesing og skriving feiler.
const KEY = "futebol_quiz_v1";

export type QuizStats = {
  best: Record<string, number>;
  answered: number;
  correct: number;
  games: number;
  daily: { last: string | null; streak: number; bestStreak: number; results: Record<string, number> };
};

const EMPTY: QuizStats = { best: {}, answered: 0, correct: 0, games: 0, daily: { last: null, streak: 0, bestStreak: 0, results: {} } };

export function loadStats(): QuizStats {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<QuizStats>;
    return { ...structuredClone(EMPTY), ...parsed, daily: { ...EMPTY.daily, ...parsed.daily } };
  } catch {
    return structuredClone(EMPTY);
  }
}

function saveStats(stats: QuizStats) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Ingen lagring tilgjengelig: quizen virker likevel, bare uten historikk.
  }
}

export const bestKey = (kind: QuizKind, format: QuizFormat) => `${kind}:${format}`;

// Lokal dato (ikke UTC), så dagens quiz bytter ved midnatt der brukeren er.
export function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d - 1));
}

export function recordGame(stats: QuizStats, game: { kind: QuizKind; format: QuizFormat; score: number; answered: number; correct: number }): { stats: QuizStats; newBest: boolean } {
  const next = structuredClone(stats);
  next.answered += game.answered;
  next.correct += game.correct;
  next.games += 1;
  let newBest = false;
  if (game.format === "daily") {
    const today = todayKey();
    if (next.daily.results[today] === undefined) {
      next.daily.results[today] = game.score;
      next.daily.streak = next.daily.last === previousDay(today) ? next.daily.streak + 1 : 1;
      next.daily.last = today;
      next.daily.bestStreak = Math.max(next.daily.bestStreak, next.daily.streak);
    }
  } else if (game.format !== "duel") {
    const key = bestKey(game.kind, game.format);
    if (game.score > (next.best[key] ?? 0)) {
      next.best[key] = game.score;
      newBest = true;
    }
  }
  saveStats(next);
  return { stats: next, newBest };
}

// Rekken teller bare hvis forrige daglige quiz var i går eller i dag.
export function currentStreak(stats: QuizStats): number {
  const today = todayKey();
  return stats.daily.last === today || stats.daily.last === previousDay(today) ? stats.daily.streak : 0;
}

export function resetStats(): QuizStats {
  saveStats(EMPTY);
  return structuredClone(EMPTY);
}
