"use client";

/* eslint-disable @next/next/no-img-element -- Bildene må lastes direkte fra /crests, /flags og /players, som service workeren lagrer for bruk uten nett. next/image går via /_next/image, som ikke er lagret. */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { buttonClass, cardClass } from "@/components/ui";
import { createDeck, type QuizContext } from "@/lib/quiz/engine";
import type { QuizFormat, QuizKind, QuizQuestion } from "@/lib/quiz/types";

export type GameConfig = { kind: QuizKind; format: QuizFormat; seed: number; players: string[]; rounds: number };
export type AnsweredQuestion = { question: QuizQuestion; picked: number | null; correct: boolean; points: number; player: number };

export const CLASSIC_QUESTIONS = 10;
export const SURVIVAL_LIVES = 3;
const TIME_ATTACK_MS = 60_000;
const FEEDBACK_MS = 700;

// Klassisk, dagens quiz og sofaduell gir poeng etter fart. Tidsjakt og overlevelse teller riktige svar.
const questionMs = (format: QuizFormat) => (format === "timeAttack" ? null : format === "survival" ? 15_000 : 20_000);
const usesSpeedPoints = (format: QuizFormat) => format === "classic" || format === "daily" || format === "duel";

export function totalQuestions(config: GameConfig): number | null {
  if (config.format === "classic" || config.format === "daily") return CLASSIC_QUESTIONS;
  if (config.format === "duel") return config.rounds * config.players.length;
  return null;
}

export function QuizGame({ config, ctx, onFinish, onQuit }: { config: GameConfig; ctx: QuizContext; onFinish: (history: AnsweredQuestion[]) => void; onQuit: () => void }) {
  const t = useT().quiz;
  const [deck] = useState(() => createDeck(config.kind, config.seed, ctx));
  const [question, setQuestion] = useState(() => deck());
  const [history, setHistory] = useState<AnsweredQuestion[]>([]);
  // undefined: ikke svart ennå. null: tiden gikk ut.
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const [passing, setPassing] = useState(config.players.length > 1);
  const perQuestion = questionMs(config.format);
  const [remaining, setRemaining] = useState(perQuestion ?? 0);
  const [gameRemaining, setGameRemaining] = useState(TIME_ATTACK_MS);
  const questionStart = useRef(0);
  // Klokkene kan rekke å kalle answer flere ganger før neste render, så svaret låses med en ref.
  const answered = useRef(false);
  const finished = useRef(false);

  const total = totalQuestions(config);
  const player = history.length % config.players.length;
  const lives = SURVIVAL_LIVES - history.filter((h) => !h.correct).length;
  const scoreOf = (p: number) => history.filter((h) => h.player === p).reduce((sum, h) => sum + h.points, 0);
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].player === player && history[i].correct; i -= config.players.length) streak++;

  const finish = (final: AnsweredQuestion[]) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(final);
  };

  const answer = (choice: number | null) => {
    if (answered.current || passing || finished.current) return;
    answered.current = true;
    const correct = choice === question.answer;
    const msLeft = perQuestion ? Math.max(0, perQuestion - (Date.now() - questionStart.current)) : 0;
    const points = !correct ? 0 : usesSpeedPoints(config.format) && perQuestion ? 50 + Math.round((50 * msLeft) / perQuestion) : 1;
    setHistory((prev) => [...prev, { question, picked: choice, correct, points, player }]);
    setPicked(choice);
  };

  const advance = () => {
    if (picked === undefined) return;
    const done =
      (total !== null && history.length >= total) ||
      (config.format === "survival" && lives <= 0);
    if (done) return finish(history);
    setQuestion(deck());
    answered.current = false;
    setPicked(undefined);
    setRemaining(perQuestion ?? 0);
    if (config.players.length > 1) setPassing(true);
  };

  // Siste versjon av funksjonene, så klokkene under ikke bruker gammel state.
  const latest = useRef({ answer, advance, finish, history });
  useEffect(() => {
    latest.current = { answer, advance, finish, history };
  });

  // Klokken for hvert spørsmål.
  useEffect(() => {
    if (passing || picked !== undefined) return;
    questionStart.current = Date.now();
    if (!perQuestion) return;
    const id = setInterval(() => {
      const left = perQuestion - (Date.now() - questionStart.current);
      setRemaining(Math.max(0, left));
      if (left <= 0) latest.current.answer(null);
    }, 100);
    return () => clearInterval(id);
  }, [question, passing, picked, perQuestion]);

  // Tidsjakt: én klokke for hele spillet, og neste spørsmål kommer automatisk.
  useEffect(() => {
    if (config.format !== "timeAttack") return;
    const start = Date.now();
    const id = setInterval(() => {
      const left = TIME_ATTACK_MS - (Date.now() - start);
      setGameRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(id);
        latest.current.finish(latest.current.history);
      }
    }, 100);
    return () => clearInterval(id);
  }, [config.format]);

  useEffect(() => {
    if (config.format !== "timeAttack" || picked === undefined) return;
    const id = setTimeout(() => latest.current.advance(), FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [config.format, picked]);

  const answeredCount = history.length - (picked !== undefined ? 1 : 0);
  const progress =
    config.format === "duel"
      ? t.play.question(Math.floor(answeredCount / config.players.length) + 1, config.rounds)
      : total
        ? t.play.question(answeredCount + 1, total)
        : t.play.questionOpen(answeredCount + 1);
  const isLast = (total !== null && history.length >= total) || (config.format === "survival" && lives <= 0);

  if (passing) {
    return (
      <div className={`${cardClass} mx-auto grid max-w-md justify-items-center gap-5 py-12 text-center`}>
        <p className="text-sm font-semibold tracking-[0.2em] text-accent">{progress.toUpperCase()}</p>
        <h2 className="text-3xl font-black">{t.duel.pass(config.players[player])}</h2>
        <button type="button" className={`${buttonClass} px-8 py-3 text-lg`} onClick={() => setPassing(false)}>{t.duel.ready}</button>
        <Scoreboard players={config.players} scoreOf={scoreOf} active={player} />
      </div>
    );
  }

  const timerFraction = config.format === "timeAttack" ? gameRemaining / TIME_ATTACK_MS : perQuestion ? remaining / perQuestion : 1;
  const secondsLeft = Math.ceil((config.format === "timeAttack" ? gameRemaining : remaining) / 1000);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-muted">{config.players.length > 1 ? `${t.duel.turn(config.players[player])} · ` : ""}{progress}</span>
        <div className="flex items-center gap-4">
          {config.format === "survival" && <span aria-label={`${t.play.lives}: ${lives}`} className="tracking-widest">{"❤️".repeat(Math.max(0, lives))}<span className="opacity-30">{"🤍".repeat(SURVIVAL_LIVES - Math.max(0, lives))}</span></span>}
          <span><span className="text-muted">{t.play.score}</span> <strong className="tabular-nums">{scoreOf(player)}</strong></span>
          <button type="button" onClick={onQuit} className="text-muted hover:text-foreground">{t.play.quit}</button>
        </div>
      </div>

      {(perQuestion || config.format === "timeAttack") && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
            <div className={`h-full rounded-full transition-[width] duration-100 ${timerFraction < 0.25 ? "bg-danger" : "bg-accent"}`} style={{ width: `${timerFraction * 100}%` }} />
          </div>
          <span className="w-8 text-right text-sm tabular-nums text-muted" aria-label={t.play.timeLeft}>{secondsLeft}</span>
        </div>
      )}

      <div className={`${cardClass} grid gap-5`}>
        <QuestionBody question={question} careerHint={t.play.careerHint} />
        <div className={`grid gap-3 ${question.kind === "truefalse" || question.kind === "oldest" ? "grid-cols-2" : "sm:grid-cols-2"}`}>
          {question.options.map((option, index) => {
            const state = picked === undefined ? "idle" : index === question.answer ? "right" : index === picked ? "wrong" : "dim";
            const tone = {
              idle: "border-border bg-surface-raised hover:border-accent hover:bg-accent-soft",
              right: "border-success bg-success/20",
              wrong: "border-danger bg-danger/20",
              dim: "border-border bg-surface-raised opacity-50",
            }[state];
            return (
              <button
                key={`${question.id}-${index}`}
                type="button"
                disabled={picked !== undefined}
                onClick={() => answer(index)}
                className={`flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-center font-semibold transition ${tone} ${option.image ? "flex-col" : ""}`}
              >
                {option.image && <img src={option.image} alt="" className="h-20 w-20 object-contain" />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {picked !== undefined && config.format !== "timeAttack" && (
        <div className={`${cardClass} grid gap-3`} role="status">
          <p className={`text-lg font-bold ${history.at(-1)?.correct ? "text-success" : "text-danger"}`}>
            {history.at(-1)?.correct ? t.play.correct : picked === null ? t.play.timeout : t.play.wrong}
            {history.at(-1)?.correct && streak >= 3 && <span className="ml-2 text-accent">{t.play.streakBonus(streak)}</span>}
          </p>
          {!history.at(-1)?.correct && <p>{t.play.answerWas(question.options[question.answer].label)}</p>}
          {question.fact && <p className="text-muted">{question.fact}</p>}
          <button type="button" autoFocus className={`${buttonClass} justify-self-start`} onClick={advance}>{isLast ? t.play.finish : t.play.next}</button>
        </div>
      )}

      {config.players.length > 1 && <Scoreboard players={config.players} scoreOf={scoreOf} active={player} />}
    </div>
  );
}

function QuestionBody({ question, careerHint }: { question: QuizQuestion; careerHint: string }) {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      {question.image && (
        <div className={`flex items-center justify-center ${question.image.variant === "photo" ? "h-48 w-48 rounded-full bg-gradient-to-b from-accent-soft to-transparent" : "h-40 w-full"}`}>
          <img
            src={question.image.src}
            alt=""
            className={question.image.variant === "flag" ? "max-h-32 rounded-md shadow-lg ring-1 ring-white/20" : question.image.variant === "crest" ? "max-h-36 object-contain" : "h-48 w-48 object-contain"}
          />
        </div>
      )}
      {question.career && (
        <div className="grid w-full gap-2">
          <p className="text-xs text-muted">{careerHint}</p>
          <ol className="flex flex-wrap items-center justify-center gap-2">
            {question.career.map((step, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium">
                <span className="text-xs tabular-nums text-muted">{i + 1}</span>
                {step.crest && <img src={step.crest} alt="" className="h-6 w-6 object-contain" />}
                {step.club}
              </li>
            ))}
          </ol>
        </div>
      )}
      <h2 className="text-xl font-bold sm:text-2xl">{question.prompt}</h2>
    </div>
  );
}

function Scoreboard({ players, scoreOf, active }: { players: string[]; scoreOf: (p: number) => number; active: number }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {players.map((name, i) => (
        <li key={i} className={`rounded-lg border px-3 py-1.5 text-sm ${i === active ? "border-accent bg-accent-soft" : "border-border"}`}>
          {name} <strong className="tabular-nums">{scoreOf(i)}</strong>
        </li>
      ))}
    </ul>
  );
}
