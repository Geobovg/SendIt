"use client";

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import {
  chooseScoutAction, collectStadiumAction, openScoutAction, sendScoutAction, speedUpStadiumAction, startStadiumUpgradeAction, type StadiumResult,
} from "@/lib/stadium-actions";
import {
  activeUpgrades, buildersFor, buildingKeys, buildings, collectable, effectiveLevels, incomeOf, levelCap, parseState, planUpgrade, scoutReward, scoutStatus, secondsLeft,
  speedupCost, storageHours, xpOf, DUGNAD_PER_LEVEL, TRIBUNE_BONUS_PER_LEVEL,
  type BuildingKey, type Collector, type StadiumLevels, type StadiumPanelState,
} from "@/lib/stadium";
import { PlayerCardFace } from "./player-card-face";
import { buttonClass, secondaryButtonClass } from "./ui";

type Props = { state: StadiumPanelState; serverNow: string; budget: number };
type Message = { ok: boolean; text: string };

// Plassering i scenen i prosent: m = mobil (høy scene), d = bredere skjermer.
type Spot = { color: string; icon: string; m: [number, number]; d: [number, number]; big?: boolean };
const look: Record<BuildingKey, Spot> = {
  klubbhus: { color: "#f2c94c", icon: "🏛️", m: [50, 11], d: [50, 15], big: true },
  billettluke: { color: "#4ade80", icon: "🎟️", m: [17, 28], d: [17, 31] },
  treningsfelt: { color: "#fb923c", icon: "🏋️", m: [83, 28], d: [83, 31] },
  kasse: { color: "#a78bfa", icon: "🏦", m: [17, 58], d: [17, 69] },
  supporterfelt: { color: "#f472b6", icon: "📣", m: [83, 58], d: [83, 69] },
  tribune: { color: "#5cc8ff", icon: "🏟️", m: [31, 85], d: [31, 88] },
  speiderhytte: { color: "#2dd4bf", icon: "🕵️", m: [69, 85], d: [69, 88] },
};

/** De to største enhetene, f.eks. «2d 4h», «3h 20min» eller «45s». */
function formatDuration(totalSeconds: number, units: { d: string; h: string; m: string; s: string }) {
  const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
  if (days) return hours ? `${days}${units.d} ${hours}${units.h}` : `${days}${units.d}`;
  if (hours) return minutes ? `${hours}${units.h} ${minutes}${units.m}` : `${hours}${units.h}`;
  if (minutes) return `${minutes}${units.m}`;
  return `${seconds}${units.s}`;
}

function Bar({ value, color, className = "" }: { value: number; color: string; className?: string }) {
  return <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`}><div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color }} /></div>;
}

export function StadiumPanel({ state: serverState, serverNow, budget }: Props) {
  const t = useT(); const text = t.stadium;
  const state = parseState(serverState);
  // Serverklokka styrer, så en klokke som går feil på enheten ikke gir feil nedtelling.
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow));
  const [selected, setSelected] = useState<BuildingKey | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(timer);
  }, [offset]);

  const levels = effectiveLevels(state, now);
  const running = activeUpgrades(state, now);
  const builderCount = buildersFor(levels);
  const income = incomeOf(levels); const xp = xpOf(levels);
  const ready = { mb: collectable(state, now, "mb"), xp: collectable(state, now, "xp") };
  const scout = scoutStatus(state, now);
  const duration = (seconds: number) => formatDuration(seconds, text.units);
  const unit = (collector: Collector) => (collector === "mb" ? text.unitMb : text.unitXp);

  const run = (action: () => Promise<StadiumResult>, success: (result: Extract<StadiumResult, { ok: true }>) => string | null) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) { const done = success(result); setMessage(done ? { ok: true, text: done } : null); } else setMessage({ ok: false, text: text.errors[result.reason] });
    });
  };
  const collect = (collector: Collector) => run(() => collectStadiumAction(collector), (result) => text.collected(result.amount ?? 0, unit(collector)));

  const effect = (key: BuildingKey, at: StadiumLevels): string => {
    const level = at[key];
    switch (key) {
      case "klubbhus": return text.effectKlubbhus(buildersFor(at), levelCap("tribune", at));
      case "billettluke": return text.perHour(incomeOf(at).perHour, text.unitMb);
      case "kasse": return text.effectKasse(storageHours[level - 1] ?? 0);
      case "treningsfelt": return level ? text.perHour(xpOf(at).perHour, text.unitXp) : text.notBuilt;
      case "tribune": return level ? text.effectTribune(Math.round(level * TRIBUNE_BONUS_PER_LEVEL * 100)) : text.notBuilt;
      case "supporterfelt": return level ? text.effectSupporter(Math.round(level * DUGNAD_PER_LEVEL * 100)) : text.notBuilt;
      case "speiderhytte": { const reward = scoutReward(level); return reward ? text.effectScout(reward.minOverall === reward.maxOverall ? `${reward.minOverall}` : `${reward.minOverall}–${reward.maxOverall}`) : text.notBuilt; }
    }
  };

  const bubble = (key: BuildingKey): ReactNode => {
    const base = "absolute -top-3 right-0 z-10 animate-bounce rounded-full border-2 border-white/80 px-2 py-0.5 text-[11px] font-black text-slate-950 shadow-lg disabled:animate-none";
    if (key === "billettluke" && ready.mb >= 1) return <button type="button" aria-label={text.collect(ready.mb, text.unitMb)} disabled={pending} onClick={() => collect("mb")} className={`${base} bg-lime-300`}>💰 {ready.mb}</button>;
    if (key === "treningsfelt" && ready.xp >= 1) return <button type="button" aria-label={text.collect(ready.xp, text.unitXp)} disabled={pending} onClick={() => collect("xp")} className={`${base} bg-amber-300`}>⭐ {ready.xp}</button>;
    if (key === "speiderhytte" && (scout === "back" || scout === "offer")) return <button type="button" aria-label={text.scoutBack} onClick={() => setSelected(key)} className={`${base} bg-teal-300`}>❗</button>;
    return null;
  };

  const tile = (key: BuildingKey) => {
    const { color, icon, m, d, big } = look[key];
    const level = levels[key]; const upgrade = running.find((entry) => entry.building === key);
    const isSelected = selected === key; const built = level > 0;
    const left = upgrade ? secondsLeft(upgrade.endsAt, now) : 0;
    const total = upgrade ? Math.max(1, (upgrade.endsAt.getTime() - upgrade.startedAt.getTime()) / 1000) : 1;
    return <div key={key} className="absolute left-(--mx) top-(--my) z-10 -translate-x-1/2 -translate-y-1/2 sm:left-(--dx) sm:top-(--dy)" style={{ "--mx": `${m[0]}%`, "--my": `${m[1]}%`, "--dx": `${d[0]}%`, "--dy": `${d[1]}%`, width: big ? "clamp(76px, 22%, 128px)" : "clamp(62px, 18%, 104px)" } as CSSProperties}>
      {bubble(key)}
      <button type="button" aria-pressed={isSelected} aria-label={`${text.buildings[key].name} · ${built ? text.level(level) : text.notBuilt}`} onClick={() => setSelected(isSelected ? null : key)}
        className={`relative grid aspect-square w-full place-items-center rounded-2xl border-2 transition ${isSelected ? "scale-110 ring-4 ring-white/80" : "hover:scale-105"} ${built ? "" : "border-dashed opacity-80"}`}
        style={{ borderColor: color, background: built ? `linear-gradient(160deg, ${color}66, #0b1420 85%)` : "rgba(8,16,27,.7)", boxShadow: built ? `0 8px 20px ${color}40` : undefined }}>
        <span className={`leading-none ${big ? "text-5xl" : "text-4xl"} ${built ? "" : "grayscale"}`}>{built ? icon : "＋"}</span>
        {built && !upgrade ? <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black text-slate-950 shadow" style={{ backgroundColor: color }}>{text.level(level)}</span> : null}
        {upgrade ? <>
          <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/55 text-3xl"><span className="animate-pulse">🚧</span></span>
          <span className="absolute inset-x-1.5 bottom-1.5"><Bar value={1 - left / total} color={color} className="h-1.5" /></span>
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-black text-amber-300">{duration(left)}</span>
        </> : null}
      </button>
      <p className="mt-3 -mx-3 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white/80 drop-shadow">{text.buildings[key].name}</p>
    </div>;
  };

  const sheet = (key: BuildingKey) => {
    const { color, icon } = look[key]; const spec = buildings[key];
    const level = levels[key]; const upgrade = running.find((entry) => entry.building === key);
    const plan = planUpgrade(state, key, now);
    const blocked = "block" in plan ? plan.block : null;
    const nextCost = "cost" in plan ? plan.cost : spec.costs[level] ?? 0;
    const affordable = "cost" in plan && budget >= plan.cost;
    const collector: Collector | null = key === "billettluke" ? "mb" : key === "treningsfelt" && level ? "xp" : null;
    const rate = collector === "mb" ? income : xp;
    const left = upgrade ? secondsLeft(upgrade.endsAt, now) : 0;
    const total = upgrade ? Math.max(1, (upgrade.endsAt.getTime() - upgrade.startedAt.getTime()) / 1000) : 1;
    const skip = upgrade ? speedupCost(left) : 0;
    const nextLevels = { ...levels, [key]: level + 1 };
    return <section className="grid gap-3 rounded-xl border-2 bg-slate-900/80 p-4" style={{ borderColor: `${color}88` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><span className="text-4xl">{icon}</span><div><h3 className="text-lg font-black">{text.buildings[key].name}</h3><p className="text-xs text-white/60">{level ? text.level(level) : text.notBuilt}</p></div></div>
        <button type="button" aria-label="×" onClick={() => setSelected(null)} className="rounded-full border border-white/20 px-2.5 py-0.5 text-sm text-white/70 hover:bg-white/10">×</button>
      </div>
      <p className="text-sm text-muted">{text.buildings[key].desc}</p>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-white/5 px-3 py-2"><dt className="text-[10px] font-black uppercase tracking-widest text-white/45">{text.now}</dt><dd className="font-bold">{effect(key, levels)}</dd></div>
        {level < spec.maxLevel ? <div className="rounded-lg bg-white/5 px-3 py-2"><dt className="text-[10px] font-black uppercase tracking-widest text-white/45">{text.next}</dt><dd className="font-bold" style={{ color }}>{effect(key, nextLevels)}</dd></div> : null}
      </dl>

      {collector ? <div className="grid gap-2 rounded-lg bg-white/5 p-3">
        <div className="flex items-baseline justify-between"><p className="text-sm font-bold">{text.perHour(rate.perHour, unit(collector))}</p><p className="font-black" style={{ color }}>{text.stored(ready[collector], rate.capacity, unit(collector))}</p></div>
        <Bar value={rate.capacity ? ready[collector] / rate.capacity : 0} color={color} />
        <button type="button" className={buttonClass} disabled={pending || ready[collector] < 1} onClick={() => collect(collector)}>{ready[collector] < 1 ? text.nothingToCollect : text.collect(ready[collector], unit(collector))}</button>
      </div> : null}

      {key === "speiderhytte" && level > 0 ? scoutArea() : null}

      {upgrade ? <div className="grid gap-2">
        <p className="text-sm font-bold">{text.upgradingTo(upgrade.to)}</p>
        <Bar value={1 - left / total} color={color} />
        <p className="text-xs font-bold text-amber-300">{text.timeLeft(duration(left))}</p>
        <button type="button" className={secondaryButtonClass} disabled={pending || budget < skip} onClick={() => run(() => speedUpStadiumAction(key), () => text.finishedNow)}>{skip === 0 ? text.speedUpFree : text.speedUp(skip)}</button>
        {budget < skip ? <p className="text-xs text-rose-300">{text.errors.no_money}</p> : null}
      </div> : blocked === "max_level" ? <p className="text-sm font-black text-lime-300">{text.maxLevel}</p> : <div className="grid gap-1.5">
        <button type="button" className={buttonClass} disabled={pending || blocked !== null || !affordable} onClick={() => run(() => startStadiumUpgradeAction(key), () => text.upgradingTo(level + 1))}>{level ? text.upgradeCost(nextCost) : text.buildCost(nextCost)}</button>
        {"cost" in plan ? <p className={`text-xs ${affordable ? "text-white/55" : "text-rose-300"}`}>{affordable ? text.takes(duration(plan.minutes * 60)) : text.errors.no_money}</p>
          : blocked === "klubbhus_low" ? <p className="text-xs text-amber-300">{text.needsClubhouse(plan.minKlubbhus ?? 1)}</p>
          : blocked === "builders_busy" ? <p className="text-xs text-amber-300">{text.errors.builders_busy}</p> : null}
      </div>}
    </section>;
  };

  /** Speideren: send ut, vent, åpne og velg mellom pakka og spilleren. */
  function scoutArea(): ReactNode {
    const current = state.scout;
    if (scout === "none" || !current) return <button type="button" className={buttonClass} disabled={pending} onClick={() => run(sendScoutAction, () => text.scoutSent)}>{text.scoutSend}</button>;
    if (scout === "away") return <div className="grid gap-2 rounded-lg bg-white/5 p-3"><p className="text-sm font-bold">{text.scoutAway(duration(secondsLeft(current.endsAt, now)))}</p><Bar value={1 - secondsLeft(current.endsAt, now) / Math.max(1, (current.endsAt.getTime() - current.startedAt.getTime()) / 1000)} color={look.speiderhytte.color} /></div>;
    if (scout === "back" || !current.offer) return <div className="grid gap-2 rounded-lg bg-white/5 p-3"><p className="text-sm font-bold text-teal-300">{text.scoutBack}</p><button type="button" className={buttonClass} disabled={pending} onClick={() => run(openScoutAction, () => null)}>{text.scoutOpen}</button></div>;
    const offer = current.offer; const player = offer.player;
    return <div className="grid gap-3 rounded-lg bg-white/5 p-3">
      <p className="text-sm font-bold text-teal-300">{player ? text.scoutChoose : text.scoutNoPlayer}</p>
      <div className={`grid gap-3 ${player ? "sm:grid-cols-2" : ""}`}>
        {player ? <div className="grid content-start gap-2">
          <PlayerCardFace player={{ slug: player.slug, name: player.name, position: player.position, overall: player.overall, accent: player.accent, club: player.club, attributes: player.attributes }} />
          <button type="button" className={buttonClass} disabled={pending || budget < player.price} onClick={() => run(() => chooseScoutAction("player"), () => text.playerAdded)}>{text.scoutBuyBtn(player.price)}</button>
          {budget < player.price ? <p className="text-xs text-rose-300">{text.errors.no_money}</p> : null}
        </div> : null}
        <div className="grid content-start gap-2 rounded-xl border border-white/15 bg-slate-950/60 p-4">
          <p className="text-3xl">🎁</p>
          <p className="text-sm font-black">{text.scoutPackIs(t.market.packs.name(offer.packKey, offer.packKey))}</p>
          <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => run(() => chooseScoutAction("pack"), () => text.packAdded)}>{text.scoutPackBtn}</button>
        </div>
      </div>
    </div>;
  }

  return <div className="grid gap-4">
    <header className="grid gap-1">
      <h2 className="text-2xl font-black">{text.title}</h2>
      <p className="max-w-3xl text-sm text-muted">{text.intro}</p>
    </header>

    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">🔨 {text.builders(running.length, builderCount)}</span>
      {running.map((upgrade) => <button key={upgrade.building} type="button" onClick={() => setSelected(upgrade.building)} className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-amber-200">{look[upgrade.building].icon} {text.buildings[upgrade.building].name} · {duration(secondsLeft(upgrade.endsAt, now))}</button>)}
      {Array.from({ length: Math.max(0, builderCount - running.length) }, (_, index) => <span key={index} className="rounded-full border border-dashed border-white/25 px-3 py-1.5 text-white/55">{text.builderFree}</span>)}
    </div>

    <div className="relative mx-auto aspect-[5/7] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-xl sm:aspect-[16/10]" style={{ background: "repeating-linear-gradient(90deg, #14532d 0, #14532d 7%, #166534 7%, #166534 14%)" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, transparent 45%, rgba(3,10,6,.65) 100%)" }} />
      <div className="absolute left-1/2 top-[44%] h-[28%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-md sm:top-1/2 sm:h-[32%] border-2 border-emerald-100/50 bg-emerald-600/40" style={{ boxShadow: `0 0 0 ${Math.round(2 + levels.tribune * 1.6)}px rgba(92,200,255,${(0.12 + levels.tribune * 0.07).toFixed(2)})` }}>
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-emerald-100/50" />
        <div className="absolute left-1/2 top-1/2 aspect-square h-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-100/50" />
      </div>
      <span className="absolute left-[6%] top-[6%] text-2xl opacity-80" aria-hidden="true">🌳</span><span className="absolute right-[6%] top-[6%] text-2xl opacity-80" aria-hidden="true">🌳</span>
      <span className="absolute left-[44%] top-[40%] text-xl sm:top-[44%]" aria-hidden="true">⚽</span>
      {buildingKeys.map(tile)}
    </div>

    {message ? <p role="status" className={`rounded-lg border px-3 py-2 text-sm font-bold ${message.ok ? "border-lime-300/40 bg-lime-300/10 text-lime-200" : "border-rose-400/40 bg-rose-400/10 text-rose-200"}`}>{message.text}</p> : null}

    {selected ? sheet(selected) : <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/65">{text.tapHint}</p>}
  </div>;
}
