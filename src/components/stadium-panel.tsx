"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { collectStadiumIncomeAction, startStadiumUpgradeAction } from "@/lib/stadium-actions";
import {
  buildingKeys, buildings, collectable, effectiveLevels, homeBonusOf, incomeOf, planUpgrade, secondsLeft, activeUpgrades,
  type BuildingKey, type StadiumState,
} from "@/lib/stadium";
import { buttonClass, cardClass } from "./ui";

/** Tilstanden slik den sendes fra serveren (datoer som tekst). */
export type StadiumPanelState = { levels: StadiumState["levels"]; upgrades: { building: BuildingKey; to: number; endsAt: string }[]; collectedAt: string };
type Props = { state: StadiumPanelState; serverNow: string; budget: number };
type Message = { ok: boolean; text: string };

const accents: Record<BuildingKey, string> = { klubbhus: "#f2c94c", billettluke: "#4ade80", tribune: "#5cc8ff" };
const icons: Record<BuildingKey, string> = { klubbhus: "🏛", billettluke: "🎟", tribune: "🏟" };

function toState(state: StadiumPanelState): StadiumState {
  return { levels: state.levels, collectedAt: new Date(state.collectedAt), upgrades: state.upgrades.map((upgrade) => ({ ...upgrade, endsAt: new Date(upgrade.endsAt) })) };
}

/** De to største enhetene, f.eks. «2d 4h», «3h 20min» eller «45s». */
function formatDuration(totalSeconds: number, units: { d: string; h: string; m: string; s: string }) {
  const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
  if (days) return hours ? `${days}${units.d} ${hours}${units.h}` : `${days}${units.d}`;
  if (hours) return minutes ? `${hours}${units.h} ${minutes}${units.m}` : `${hours}${units.h}`;
  if (minutes) return `${minutes}${units.m}`;
  return `${seconds}${units.s}`;
}

const bonusText = (bonus: number) => bonus.toFixed(1);

function Bar({ value, color }: { value: number; color: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color }} /></div>;
}

/** Banen sett ovenfra. Tribunene vokser og fylles med nivået på tribunen. */
function Pitch({ tribune }: { tribune: number }) {
  const depth = 4 + tribune * 2.2; const crowd = Math.min(1, tribune / 10);
  return <svg viewBox="0 0 320 150" className="w-full" role="img" aria-hidden="true">
    <rect width="320" height="150" rx="14" fill="#07111a" />
    <rect x="30" y={18 + depth} width="260" height={114 - depth * 2} rx="6" fill="#14532d" />
    <g fill="none" stroke="#bbf7d0" strokeOpacity=".55" strokeWidth="1.4">
      <rect x="44" y={30 + depth} width="232" height={90 - depth * 2} />
      <line x1="160" y1={30 + depth} x2="160" y2={120 - depth} />
      <circle cx="160" cy="75" r="16" />
    </g>
    <rect x="30" y="18" width="260" height={depth} rx="3" fill="#5cc8ff" fillOpacity={0.12 + crowd * 0.7} />
    <rect x="30" y={132 - depth} width="260" height={depth} rx="3" fill="#5cc8ff" fillOpacity={0.12 + crowd * 0.7} />
  </svg>;
}

export function StadiumPanel({ state: initialState, serverNow, budget }: Props) {
  const t = useT().stadium;
  const state = toState(initialState);
  // Serverklokka styrer, så en klokke som går feil på enheten ikke gir feil nedtelling.
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow));
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(timer);
  }, [offset]);

  const levels = effectiveLevels(state, now);
  const running = activeUpgrades(state, now);
  const income = incomeOf(levels);
  const ready = collectable(state, now);
  const bonus = homeBonusOf(levels);
  const builderBusy = running.length > 0;

  const run = (action: () => ReturnType<typeof collectStadiumIncomeAction>, success: (amount?: number) => string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { ok: true, text: success(result.amount) } : { ok: false, text: t.errors[result.reason] });
    });
  };

  return <div className="grid gap-4">
    <section className={`${cardClass} grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center`}>
      <div className="grid gap-2">
        <h2 className="text-2xl font-black">{t.title}</h2>
        <p className="text-sm text-muted">{t.intro}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{t.builderLabel}: <span className={builderBusy ? "text-amber-300" : "text-lime-300"}>{builderBusy ? t.builderBusy : t.builderFree}</span></span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-cyan-200">{t.homeBonus(bonusText(bonus))}</span>
        </div>
      </div>
      <Pitch tribune={levels.tribune} />
    </section>

    <section className={`${cardClass} grid gap-3`} style={{ borderColor: `${accents.billettluke}55` }}>
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-lg font-black">{icons.billettluke} {t.buildings.billettluke.name}</h3><p className="text-sm text-muted">{t.perHour(income.perHour)}</p></div>
        <p className="text-right text-lg font-black text-lime-300">{t.stored(ready, income.capacity)}</p>
      </div>
      <Bar value={income.capacity ? ready / income.capacity : 0} color={accents.billettluke} />
      <button type="button" className={buttonClass} disabled={pending || ready < 1} onClick={() => run(collectStadiumIncomeAction, (amount) => t.collected(amount ?? 0))}>{ready < 1 ? t.nothingToCollect : t.collect(ready)}</button>
    </section>

    {message ? <p role="status" className={`rounded-lg border px-3 py-2 text-sm font-bold ${message.ok ? "border-lime-300/40 bg-lime-300/10 text-lime-200" : "border-rose-400/40 bg-rose-400/10 text-rose-200"}`}>{message.text}</p> : null}

    <div className="grid gap-4 md:grid-cols-3">
      {buildingKeys.map((key) => {
        const spec = buildings[key]; const level = levels[key]; const upgrade = running.find((entry) => entry.building === key);
        const plan = planUpgrade(state, key, now); const text = t.buildings[key];
        const affordable = "cost" in plan && budget >= plan.cost;
        const blocked = "block" in plan ? plan.block : null;
        return <section key={key} className={`${cardClass} grid content-start gap-3`} style={{ borderColor: `${accents[key]}55` }}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-black">{icons[key]} {text.name}</h3>
            <span className="rounded-full px-2.5 py-1 text-xs font-black text-slate-950" style={{ backgroundColor: accents[key] }}>{level ? t.level(level) : t.notBuilt}</span>
          </div>
          <p className="text-sm text-muted">{text.desc}</p>
          {key === "tribune" ? <p className="text-xs text-white/55">{t.tribuneHint}</p> : null}
          <div className="flex gap-1" aria-hidden="true">{Array.from({ length: spec.maxLevel }, (_, index) => <span key={index} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: index < level ? accents[key] : "rgba(255,255,255,.12)" }} />)}</div>
          {upgrade ? <div className="grid gap-1.5">
            <p className="text-sm font-bold">{t.upgradingTo(upgrade.to)}</p>
            <Bar value={1 - secondsLeft(upgrade.endsAt, now) / (spec.minutes[upgrade.to - 1] * 60)} color={accents[key]} />
            <p className="text-xs font-bold text-amber-300">{t.timeLeft(formatDuration(secondsLeft(upgrade.endsAt, now), t.units))}</p>
          </div> : blocked === "max_level" ? <p className="text-sm font-black text-lime-300">{t.maxLevel}</p> : <div className="grid gap-1.5">
            <button type="button" className={buttonClass} disabled={pending || blocked !== null || !affordable} onClick={() => run(() => startStadiumUpgradeAction(key), () => t.upgradingTo(level + 1))}>
              {(() => { const cost = "cost" in plan ? plan.cost : spec.costs[level] ?? 0; return level ? t.upgradeCost(cost) : t.buildCost(cost); })()}
            </button>
            {"cost" in plan ? <p className={`text-xs ${affordable ? "text-white/55" : "text-rose-300"}`}>{affordable ? t.takes(formatDuration(plan.minutes * 60, t.units)) : t.errors.no_money}</p>
              : blocked === "klubbhus_low" ? <p className="text-xs text-amber-300">{t.needsClubhouse(plan.minKlubbhus ?? 1)}</p>
              : blocked === "builders_busy" ? <p className="text-xs text-amber-300">{t.errors.builders_busy}</p> : null}
          </div>}
        </section>;
      })}
    </div>
  </div>;
}
