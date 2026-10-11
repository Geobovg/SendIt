"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALES } from "@/i18n/locales";
import { buttonClass, cardClass, secondaryButtonClass } from "@/components/ui";
import { questionCount, seedFromString, type QuizContext } from "@/lib/quiz/engine";
import { bestKey, currentStreak, loadStats, recordGame, resetStats, todayKey, type QuizStats } from "@/lib/quiz/stats";
import { QUIZ_FORMATS, QUIZ_KINDS, type QuizKind } from "@/lib/quiz/types";
import { QuizGame, totalQuestions, type AnsweredQuestion, type GameConfig } from "./quiz-game";
import { useOfflineQuiz } from "./use-offline-quiz";

type Screen =
  | { type: "home" }
  | { type: "duelSetup"; kind: QuizKind }
  | { type: "play"; config: GameConfig; round: number }
  | { type: "result"; config: GameConfig; history: AnsweredQuestion[]; newBest: boolean };

const KIND_ICONS: Record<QuizKind, string> = { mixed: "🎲", trivia: "🧠", truefalse: "✅", player: "📸", crest: "🛡️", flag: "🏳️", career: "🧭", oldest: "📜", year: "📅" };
const MAX_DUEL_PLAYERS = 4;

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

// Statistikken leses fra localStorage etter første render, så server-HTML og nettleser er like.
const subscribeNothing = () => () => {};

export function QuizApp() {
  const t = useT().quiz;
  const locale = useLocale();
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [statsOverride, setStatsOverride] = useState<QuizStats | null>(null);
  const stats = useMemo(() => statsOverride ?? (hydrated ? loadStats() : null), [statsOverride, hydrated]);
  const [screen, setScreen] = useState<Screen>({ type: "home" });
  const [format, setFormat] = useState<(typeof QUIZ_FORMATS)[number]>("classic");
  const [duelPlayers, setDuelPlayers] = useState<string[]>(["", ""]);
  const [duelRounds, setDuelRounds] = useState(5);
  const { status, online } = useOfflineQuiz();

  const ctx: QuizContext = useMemo(
    () => ({
      lang: locale === "no" ? "no" : "en",
      intlLocale: INTL_LOCALES[locale],
      labels: { ...t.prompts, flagNames: t.flagNames },
    }),
    [locale, t],
  );

  const today = todayKey();
  const dailyScore = stats?.daily.results[today];

  const start = (config: Omit<GameConfig, "players" | "rounds"> & Partial<GameConfig>) =>
    setScreen((prev) => ({ type: "play", config: { players: [""], rounds: 0, ...config }, round: prev.type === "play" ? prev.round + 1 : Date.now() }));

  const pickKind = (kind: QuizKind) => {
    if (format === "duel") setScreen({ type: "duelSetup", kind });
    else start({ kind, format, seed: randomSeed() });
  };

  const finish = (config: GameConfig, history: AnsweredQuestion[]) => {
    const score = history.reduce((sum, h) => sum + h.points, 0);
    const result = recordGame(stats ?? loadStats(), { kind: config.kind, format: config.format, score, answered: history.length, correct: history.filter((h) => h.correct).length });
    setStatsOverride(result.stats);
    setScreen({ type: "result", config, history, newBest: result.newBest });
  };

  if (screen.type === "play") {
    return <QuizGame key={screen.round} config={screen.config} ctx={ctx} onFinish={(history) => finish(screen.config, history)} onQuit={() => setScreen({ type: "home" })} />;
  }

  if (screen.type === "result") {
    const again = () => (screen.config.format === "daily" ? setScreen({ type: "home" }) : start({ ...screen.config, seed: randomSeed() }));
    return <QuizResult config={screen.config} history={screen.history} newBest={screen.newBest} onAgain={again} onMenu={() => setScreen({ type: "home" })} />;
  }

  if (screen.type === "duelSetup") {
    const names = duelPlayers.map((name, i) => name.trim() || t.duel.playerName(i + 1));
    return (
      <div className={`${cardClass} mx-auto grid w-full max-w-md gap-5`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t.duel.title}</h1>
          <span className="text-sm text-muted">{KIND_ICONS[screen.kind]} {t.kinds[screen.kind].title}</span>
        </div>
        <div className="grid gap-2">
          {duelPlayers.map((name, i) => (
            <div key={i} className="flex gap-2">
              <input value={name} maxLength={20} placeholder={t.duel.playerName(i + 1)} onChange={(e) => setDuelPlayers((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))} className="flex-1" />
              {duelPlayers.length > 2 && <button type="button" className={secondaryButtonClass} onClick={() => setDuelPlayers((prev) => prev.filter((_, j) => j !== i))}>{t.duel.remove}</button>}
            </div>
          ))}
          {duelPlayers.length < MAX_DUEL_PLAYERS && <button type="button" className={`${secondaryButtonClass} justify-self-start`} onClick={() => setDuelPlayers((prev) => [...prev, ""])}>+ {t.duel.addPlayer}</button>}
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium text-muted">{t.duel.rounds}</span>
          <div className="flex gap-2">
            {[3, 5, 10].map((n) => (
              <button key={n} type="button" onClick={() => setDuelRounds(n)} className={`rounded-lg border px-4 py-2 font-semibold ${duelRounds === n ? "border-accent bg-accent-soft" : "border-border"}`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => setScreen({ type: "home" })}>{t.back}</button>
          <button type="button" className={buttonClass} onClick={() => start({ kind: screen.kind, format: "duel", seed: randomSeed(), players: names, rounds: duelRounds })}>{t.start}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-accent">{t.menu.kicker}</p>
          <h1 className="mt-2 text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-muted">{t.intro}</p>
          <OfflineBadge status={status} online={online} />
        </div>
        <Link href="/" className={secondaryButtonClass}>{t.back}</Link>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-violet-500/35 via-indigo-950 to-slate-950 p-6 text-white sm:p-8">
        <div className="absolute -right-6 -top-8 text-[10rem] leading-none opacity-10" aria-hidden>⚽</div>
        <div className="relative grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black">{t.daily.title}</h2>
            {stats && currentStreak(stats) > 0 && <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">🔥 {t.daily.streak(currentStreak(stats))}</span>}
          </div>
          <p className="max-w-xl text-white/80">{t.daily.description}</p>
          {dailyScore !== undefined ? (
            <p className="font-semibold">{t.daily.done(dailyScore)}</p>
          ) : (
            <button type="button" className={`${buttonClass} justify-self-start bg-white text-slate-950 hover:bg-white/90`} onClick={() => start({ kind: "mixed", format: "daily", seed: seedFromString(`daily-${today}`) })}>{t.daily.play}</button>
          )}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {QUIZ_FORMATS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={format === f} onClick={() => setFormat(f)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${format === f ? "border-accent bg-accent text-accent-contrast" : "border-border hover:bg-surface-raised"}`}>
              {t.formats[f].title}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{t.formats[format].description}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUIZ_KINDS.map((kind) => {
            const best = stats?.best[bestKey(kind, format)];
            return (
              <button key={kind} type="button" onClick={() => pickKind(kind)} className={`${cardClass} group grid gap-2 text-left transition hover:-translate-y-0.5 hover:border-accent`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl" aria-hidden>{KIND_ICONS[kind]}</span>
                  {best !== undefined && format !== "duel" && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{t.best(best)}</span>}
                </div>
                <h3 className="text-lg font-bold">{t.kinds[kind].title}</h3>
                <p className="text-sm text-muted">{t.kinds[kind].description}</p>
                <p className="text-xs text-muted">{t.questions(questionCount(kind))}</p>
              </button>
            );
          })}
        </div>
        {locale !== "no" && locale !== "en" && <p className="text-xs text-muted">{t.contentLanguageNote}</p>}
      </section>

      {stats && stats.games > 0 && <StatsPanel stats={stats} onReset={() => setStatsOverride(resetStats())} />}
    </div>
  );
}

function OfflineBadge({ status, online }: { status: string; online: boolean }) {
  const t = useT().quiz.offline;
  if (!online) return <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">📴 {t.youAreOffline}</p>;
  if (status === "ready") return <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success">✓ {t.ready}</p>;
  if (status === "saving") return <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-raised px-3 py-1 text-sm text-muted">⏳ {t.saving}</p>;
  if (status === "unsupported") return <p className="mt-3 text-xs text-muted">{t.unsupported}</p>;
  return null;
}

function QuizResult({ config, history, newBest, onAgain, onMenu }: { config: GameConfig; history: AnsweredQuestion[]; newBest: boolean; onAgain: () => void; onMenu: () => void }) {
  const t = useT().quiz;
  const total = totalQuestions(config) ?? history.length;
  const score = history.reduce((sum, h) => sum + h.points, 0);
  const correct = history.filter((h) => h.correct).length;
  const duel = config.players.length > 1;
  const ranking = config.players
    .map((name, i) => ({ name, score: history.filter((h) => h.player === i).reduce((sum, h) => sum + h.points, 0) }))
    .sort((a, b) => b.score - a.score);
  const headline = duel ? (ranking[0].score === ranking[1].score ? t.duel.draw : t.duel.winner(ranking[0].name)) : null;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <div className={`${cardClass} grid justify-items-center gap-3 py-8 text-center`}>
        <p className="text-sm font-semibold tracking-[0.2em] text-accent">{(config.format === "daily" ? t.daily.title : t.kinds[config.kind].title).toUpperCase()}</p>
        {duel ? (
          <>
            <h1 className="text-3xl font-black">🏆 {headline}</h1>
            <ol className="grid w-full max-w-xs gap-2">
              {ranking.map((r, i) => (
                <li key={r.name + i} className="flex justify-between rounded-lg border border-border px-4 py-2"><span>{i + 1}. {r.name}</span><strong className="tabular-nums">{r.score}</strong></li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <p className="text-6xl font-black tabular-nums">{score}</p>
            <p className="text-muted">{t.result.score}</p>
            <p className="font-semibold">{t.result.correct(correct, config.format === "timeAttack" || config.format === "survival" ? history.length : total)}</p>
            {newBest && <p className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">🎉 {t.result.newBest}</p>}
          </>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {config.format !== "daily" && <button type="button" autoFocus className={buttonClass} onClick={onAgain}>{t.result.again}</button>}
          <button type="button" className={secondaryButtonClass} onClick={onMenu}>{t.result.menu}</button>
        </div>
      </div>

      <section className="grid gap-2">
        <h2 className="font-semibold">{t.result.review}</h2>
        <ol className="grid gap-2">
          {history.map((h, i) => (
            <li key={i} className={`rounded-lg border px-4 py-3 text-sm ${h.correct ? "border-success/40" : "border-danger/40"}`}>
              <p className="font-medium">{h.correct ? "✓" : "✗"} {h.question.prompt}{duel ? ` · ${config.players[h.player]}` : ""}</p>
              <p className="text-muted">
                {h.question.options[h.question.answer].label}
                {!h.correct && ` · ${t.result.yourAnswer}: ${h.picked === null ? t.result.noAnswer : h.question.options[h.picked].label}`}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function StatsPanel({ stats, onReset }: { stats: QuizStats; onReset: () => void }) {
  const t = useT().quiz.stats;
  const accuracy = stats.answered ? Math.round((100 * stats.correct) / stats.answered) : 0;
  const items = [
    { label: t.games, value: stats.games },
    { label: t.answered, value: stats.answered },
    { label: t.accuracy, value: `${accuracy} %` },
    { label: t.bestStreak, value: stats.daily.bestStreak },
  ];
  return (
    <section className={`${cardClass} grid gap-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t.title}</h2>
        <button type="button" className="text-sm text-muted hover:text-foreground" onClick={() => window.confirm(t.confirmReset) && onReset()}>{t.reset}</button>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-surface-raised p-3">
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
