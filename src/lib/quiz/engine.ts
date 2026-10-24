import { clubCrest, clubsWithCrest } from "@/lib/club-crests";
import { CAREERS, FLAG_CODES, FOUNDED, PHOTO_PLAYERS } from "./data/people";
import { STATEMENTS } from "./data/statements";
import { TRIVIA } from "./data/trivia";
import { YEARS } from "./data/years";
import type { QuestionKind, QuizKind, QuizLang, QuizOption, QuizQuestion } from "./types";

// Tekst motoren trenger fra ordboken, så spørsmålene følger språket i appen.
export type QuizLabels = {
  player: string;
  crest: string;
  flag: string;
  career: string;
  oldest: string;
  trueLabel: string;
  falseLabel: string;
  founded: (club: string, year: number) => string;
  flagNames: Record<string, string>;
};

export type QuizContext = { lang: QuizLang; intlLocale: string; labels: QuizLabels };

// Deterministisk tilfeldighet, så «Dagens quiz» blir lik for alle på samme dag.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOthers<T>(pool: readonly T[], exclude: (item: T) => boolean, count: number, rand: () => number): T[] {
  return shuffle(pool.filter((item) => !exclude(item)), rand).slice(0, count);
}

// Blander riktig svar inn blant feilsvarene og husker hvor det havnet.
function withOptions(base: Omit<QuizQuestion, "options" | "answer">, correct: QuizOption, wrong: QuizOption[], rand: () => number): QuizQuestion {
  const options = shuffle([correct, ...wrong], rand);
  return { ...base, options, answer: options.indexOf(correct) };
}

const text = (value: string | [string, string], lang: QuizLang) => (typeof value === "string" ? value : lang === "no" ? value[0] : value[1]);

function regionName(code: string, ctx: QuizContext): string {
  const special = ctx.labels.flagNames[code];
  if (special) return special;
  try {
    return new Intl.DisplayNames([ctx.intlLocale], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

// Hver spørsmålstype har en pott med kilder. En kortstokk trekker fra potten uten å gjenta seg
// før alle er brukt, og stokker på nytt når den er tom.
type Generator = { size: number; make: (index: number, rand: () => number, ctx: QuizContext) => QuizQuestion };

const CRESTS = clubsWithCrest();

const GENERATORS: Record<QuestionKind, Generator> = {
  trivia: {
    size: TRIVIA.length,
    make(index, rand, { lang }) {
      const item = TRIVIA[index];
      return withOptions(
        { id: `trivia-${index}`, kind: "trivia", prompt: item.q[lang], fact: item.fact?.[lang] },
        { label: text(item.a, lang) },
        item.wrong.map((w) => ({ label: text(w, lang) })),
        rand,
      );
    },
  },
  truefalse: {
    size: STATEMENTS.length,
    make(index, _rand, { lang, labels }) {
      const item = STATEMENTS[index];
      // Sant står alltid først, så knappene ikke bytter plass mellom spørsmålene.
      return { id: `tf-${index}`, kind: "truefalse", prompt: item.s[lang], fact: item.fact?.[lang], options: [{ label: labels.trueLabel }, { label: labels.falseLabel }], answer: item.true ? 0 : 1 };
    },
  },
  player: {
    size: PHOTO_PLAYERS.length,
    make(index, rand, { labels }) {
      const player = PHOTO_PLAYERS[index];
      const wrong = pickOthers(PHOTO_PLAYERS, (p) => p.slug === player.slug, 3, rand);
      return withOptions(
        { id: `player-${player.slug}`, kind: "player", prompt: labels.player, image: { src: `/players/${player.slug}.webp`, variant: "photo" } },
        { label: player.name },
        wrong.map((p) => ({ label: p.name })),
        rand,
      );
    },
  },
  crest: {
    size: CRESTS.length,
    make(index, rand, { labels }) {
      const club = CRESTS[index];
      const wrong = pickOthers(CRESTS, (c) => c.club === club.club, 3, rand);
      return withOptions(
        { id: `crest-${club.club}`, kind: "crest", prompt: labels.crest, image: { src: club.crest, variant: "crest" } },
        { label: club.club },
        wrong.map((c) => ({ label: c.club })),
        rand,
      );
    },
  },
  flag: {
    size: FLAG_CODES.length,
    make(index, rand, ctx) {
      const code = FLAG_CODES[index];
      const wrong = pickOthers(FLAG_CODES, (c) => c === code, 3, rand);
      return withOptions(
        { id: `flag-${code}`, kind: "flag", prompt: ctx.labels.flag, image: { src: `/flags/${code}.svg`, variant: "flag" } },
        { label: regionName(code, ctx) },
        wrong.map((c) => ({ label: regionName(c, ctx) })),
        rand,
      );
    },
  },
  career: {
    size: CAREERS.length,
    make(index, rand, { labels }) {
      const player = CAREERS[index];
      const wrong = pickOthers(CAREERS, (p) => p.name === player.name, 3, rand);
      return withOptions(
        { id: `career-${index}`, kind: "career", prompt: labels.career, career: player.clubs.map((club) => ({ club, crest: clubCrest(club) })) },
        { label: player.name },
        wrong.map((p) => ({ label: p.name })),
        rand,
      );
    },
  },
  oldest: {
    size: FOUNDED.length,
    make(index, rand, { labels }) {
      const club = FOUNDED[index];
      const [other] = pickOthers(FOUNDED, (c) => c.year === club.year, 1, rand);
      const pair = shuffle([club, other], rand);
      return {
        id: `oldest-${club.club}-${other.club}`,
        kind: "oldest",
        prompt: labels.oldest,
        options: pair.map((c) => ({ label: c.club, image: clubCrest(c.club) ?? undefined })),
        answer: pair[0].year < pair[1].year ? 0 : 1,
        fact: pair.map((c) => labels.founded(c.club, c.year)).join(" · "),
      };
    },
  },
  year: {
    size: YEARS.length,
    make(index, rand, { lang }) {
      const item = YEARS[index];
      const offsets = shuffle([-12, -8, -6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 8, 12], rand);
      // Ingen årstall i framtiden. Det finnes alltid minst åtte bakover, så det blir nok feilsvar.
      const wrong = offsets.map((o) => item.year + o).filter((year) => year <= new Date().getFullYear()).slice(0, 3);
      return withOptions(
        { id: `year-${index}`, kind: "year", prompt: item.q[lang] },
        { label: String(item.year) },
        wrong.map((year) => ({ label: String(year) })),
        rand,
      );
    },
  },
};

export const QUESTION_KINDS = Object.keys(GENERATORS) as QuestionKind[];

export function questionCount(kind: QuizKind): number {
  return kind === "mixed" ? QUESTION_KINDS.reduce((sum, k) => sum + GENERATORS[k].size, 0) : GENERATORS[kind].size;
}

// En uendelig strøm av spørsmål. «Blandet» bytter type for hvert spørsmål og unngår samme type to ganger på rad.
export function createDeck(kind: QuizKind, seed: number, ctx: QuizContext): () => QuizQuestion {
  const rand = seededRandom(seed);
  const orders = new Map<QuestionKind, number[]>();
  let lastKind: QuestionKind | null = null;

  const draw = (k: QuestionKind): QuizQuestion => {
    let order = orders.get(k);
    if (!order || order.length === 0) {
      order = shuffle(Array.from({ length: GENERATORS[k].size }, (_, i) => i), rand);
      orders.set(k, order);
    }
    return GENERATORS[k].make(order.pop()!, rand, ctx);
  };

  return () => {
    if (kind !== "mixed") return draw(kind);
    const choices = QUESTION_KINDS.filter((k) => k !== lastKind);
    lastKind = choices[Math.floor(rand() * choices.length)];
    return draw(lastKind);
  };
}

// Bildene quizen kan vise, så de kan lagres for bruk uten nett.
export function quizImageUrls(): string[] {
  const crests = new Set(CRESTS.map((c) => c.crest));
  return [...crests, ...PHOTO_PLAYERS.map((p) => `/players/${p.slug}.webp`), ...FLAG_CODES.map((c) => `/flags/${c}.svg`)];
}
