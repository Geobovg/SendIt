// Quizen kjører helt i nettleseren og trenger verken innlogging eller nett.
// Tekst i spørsmålene finnes på norsk og engelsk; andre språk får den engelske teksten.
export type QuizText = { no: string; en: string };
export type QuizLang = keyof QuizText;

export const QUIZ_KINDS = ["mixed", "trivia", "truefalse", "player", "crest", "flag", "career", "oldest", "year"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];
export type QuestionKind = Exclude<QuizKind, "mixed">;

// classic: 10 spørsmål med klokke. timeAttack: så mange du rekker på 60 sekunder.
// survival: tre liv. duel: flere spillere bytter på samme telefon. daily: samme 10 spørsmål for alle, én gang per dag.
export const QUIZ_FORMATS = ["classic", "timeAttack", "survival", "duel"] as const;
export type QuizFormat = (typeof QUIZ_FORMATS)[number] | "daily";

export type QuizOption = { label: string; image?: string };

export type QuizQuestion = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  image?: { src: string; variant: "photo" | "crest" | "flag" };
  career?: { club: string; crest: string | null }[];
  options: QuizOption[];
  answer: number;
  fact?: string;
};
