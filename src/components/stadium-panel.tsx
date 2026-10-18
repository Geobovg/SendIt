"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import {
  chooseScoutAction, collectStadiumAction, openScoutAction, sendScoutAction, speedUpStadiumAction, startStadiumUpgradeAction, type StadiumResult,
} from "@/lib/stadium-actions";
import {
  activeUpgrades, buildersFor, buildingKeys, buildings, collectable, effectiveLevels, incomeOf, levelCap, parseState, planUpgrade, scoutReward, scoutStatus, seatsOf, secondsLeft,
  speedupCost, storageHours, xpOf, DUGNAD_PER_LEVEL, TRIBUNE_BONUS_PER_LEVEL,
  type BuildingKey, type Collector, type StadiumLevels, type StadiumPanelState,
} from "@/lib/stadium";
import { PlayerCardFace } from "./player-card-face";
import { SCENE_H, SCENE_W, StadiumScene, sceneSpots } from "./stadium-scene";
import { buttonClass, secondaryButtonClass } from "./ui";

type Props = { state: StadiumPanelState; serverNow: string; budget: number };

// Farge og ikon for hver bygning. Hvor den står i scenen, ligger i `sceneSpots` i stadium-scene.tsx.
type Spot = { color: string; icon: string };
const look: Record<BuildingKey, Spot> = {
  klubbhus: { color: "#f2c94c", icon: "🏛️" },
  billettluke: { color: "#4ade80", icon: "🎟️" },
  treningsfelt: { color: "#fb923c", icon: "🏋️" },
  kasse: { color: "#a78bfa", icon: "🏦" },
  supporterfelt: { color: "#f472b6", icon: "📣" },
  tribune: { color: "#5cc8ff", icon: "🏟️" },
  speiderhytte: { color: "#2dd4bf", icon: "🕵️" },
};

const percent = (value: number, total: number) => `${(value / total) * 100}%`;
/** 12 400 i stedet for 12400, med fast mellomrom så server og nettleser skriver likt. */
const spaced = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

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

const confettiColors = ["#f472b6", "#38bdf8", "#fde68a", "#4ade80", "#ffffff", "#fb923c"];

/** Liten feiring over scenen: konfetti og en melding. Forsvinner av seg selv, eller når man trykker på den. */
function Celebration({ level, seats, onDone }: { level: number; seats: string; onDone: () => void }) {
  const text = useT().stadium;
  useEffect(() => {
    const timer = setTimeout(onDone, 5200);
    return () => clearTimeout(timer);
  }, [onDone]);
  return <>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {Array.from({ length: 42 }, (_, i) => <span key={i} className="stadium-confetti" style={{ left: `${(i * 37) % 100}%`, width: 6 + (i % 3) * 2, height: 9 + (i % 4) * 2, backgroundColor: confettiColors[i % confettiColors.length], borderRadius: i % 3 ? 1 : 9, ["--d" as string]: `${((i * 13) % 20) / 10}s`, ["--dx" as string]: `${((i * 29) % 90) - 45}px`, ["--spin" as string]: `${360 + ((i * 53) % 540)}deg` } as CSSProperties} />)}
    </div>
    <button type="button" onClick={onDone} role="status" className="stadium-toast absolute left-1/2 top-[13%] z-30 grid w-[min(86%,20rem)] gap-1 rounded-2xl border-2 border-sky-300/60 bg-slate-950/90 px-5 py-4 text-center shadow-2xl">
      <span className="text-4xl" aria-hidden="true">🎉</span>
      <span className="text-lg font-black leading-tight text-white">{text.levelUp(level)}</span>
      <span className="text-sm font-bold text-sky-200">🏟️ {text.capacity(seats)}</span>
    </button>
  </>;
}

export function StadiumPanel({ state: serverState, serverNow, budget }: Props) {
  const t = useT(); const text = t.stadium;
  const state = parseState(serverState);
  // Serverklokka styrer, så en klokke som går feil på enheten ikke gir feil nedtelling.
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow));
  const [selected, setSelected] = useState<BuildingKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Kveldsmodus: flomlysene på. Som standard etter klokka (kveld og natt), og man kan velge selv. Valget huskes bare i denne nettleseren.
  const [night, setNight] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem("stadium-night"); } catch { stored = null; }
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- klokka og lagringen finnes bare i nettleseren, så valget kan først settes etter at siden er lastet
    setNight(stored === null ? hour >= 19 || hour < 6 : stored === "1");
  }, []);
  const toggleNight = () => {
    setNight(!night);
    try { window.localStorage.setItem("stadium-night", night ? "0" : "1"); } catch { /* Uten lagring huskes ikke valget. */ }
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(timer);
  }, [offset]);

  const levels = effectiveLevels(state, now);

  // Feiring når tribunen får nytt nivå, enten mens man ser på eller mens man var borte (det sist sette nivået huskes i nettleseren).
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const seenTribune = useRef<number | null>(null);
  const closeCelebration = useCallback(() => setCelebrate(null), []);
  useEffect(() => {
    let stored = 0;
    try { stored = Number(window.localStorage.getItem("stadium-tribune-seen")) || 0; } catch { stored = 0; }
    const before = seenTribune.current ?? stored;
    seenTribune.current = levels.tribune;
    try { window.localStorage.setItem("stadium-tribune-seen", String(levels.tribune)); } catch { /* Uten lagring feires bare nivåer man ser komme mens siden er åpen. */ }
    if (before > 0 && levels.tribune > before) setCelebrate(levels.tribune);
  }, [levels.tribune]);
  const running = activeUpgrades(state, now);
  const builderCount = buildersFor(levels);
  const income = incomeOf(levels); const xp = xpOf(levels);
  const ready = { mb: collectable(state, now, "mb"), xp: collectable(state, now, "xp") };
  const scout = scoutStatus(state, now);
  const duration = (seconds: number) => formatDuration(seconds, text.units);
  const unit = (collector: Collector) => (collector === "mb" ? text.unitMb : text.unitXp);

  // Bare feil vises. Når noe lykkes, ser man det på selve stadionet.
  const run = (action: () => Promise<StadiumResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(text.errors[result.reason]);
    });
  };
  const collect = (collector: Collector) => run(() => collectStadiumAction(collector));

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

  // Trykkflaten over tegningen: selve bygningen er tegnet av StadiumScene, her ligger bare knappen, bobler og tekst.
  const tile = (key: BuildingKey) => {
    const { color } = look[key]; const spot = sceneSpots[key];
    const level = levels[key]; const upgrade = running.find((entry) => entry.building === key);
    const isSelected = selected === key; const built = level > 0;
    const left = upgrade ? secondsLeft(upgrade.endsAt, now) : 0;
    const total = upgrade ? Math.max(1, (upgrade.endsAt.getTime() - upgrade.startedAt.getTime()) / 1000) : 1;
    const frame = isSelected ? "border-white/90 bg-white/10 ring-4 ring-white/40" : "border-transparent hover:border-white/40 hover:bg-white/5";
    return <div key={key} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: percent(spot.x, SCENE_W), top: percent(spot.y, SCENE_H), width: percent(spot.w, SCENE_W), height: percent(spot.h, SCENE_H) }}>
      {bubble(key)}
      <button type="button" aria-pressed={isSelected} aria-label={`${text.buildings[key].name} · ${built ? text.level(level) : text.notBuilt}`} onClick={() => setSelected(isSelected ? null : key)} className={`absolute inset-0 rounded-2xl border-2 transition ${frame}`}>
        {!built && !upgrade ? <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-slate-950/80 text-xl font-black" style={{ borderColor: color, color }}>＋</span> : null}
        {upgrade ? (key === "tribune"
          ? <span className="absolute inset-x-24 bottom-1 grid justify-items-center gap-1"><span className="whitespace-nowrap rounded-full bg-slate-950/90 px-2 py-0.5 text-[10px] font-black text-amber-300">🚧 {duration(left)}</span><Bar value={1 - left / total} color={color} className="h-1.5 w-full" /></span>
          : <>
            <span className="absolute inset-x-2 bottom-2"><Bar value={1 - left / total} color={color} className="h-1.5" /></span>
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-black text-amber-300">🚧 {duration(left)}</span>
          </>) : null}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 flex -translate-x-1/2 flex-col items-center gap-0.5 pt-0.5">
        {built && !upgrade ? <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black text-slate-950 shadow" style={{ backgroundColor: color }}>{text.level(level)}</span> : null}
        <p className="whitespace-nowrap text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white/85 [text-shadow:0_1px_3px_#000]">{text.buildings[key].name}</p>
      </div>
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
        <button type="button" className={secondaryButtonClass} disabled={pending || budget < skip} onClick={() => run(() => speedUpStadiumAction(key))}>{skip === 0 ? text.speedUpFree : text.speedUp(skip)}</button>
        {budget < skip ? <p className="text-xs text-rose-300">{text.errors.no_money}</p> : null}
      </div> : blocked === "max_level" ? <p className="text-sm font-black text-lime-300">{text.maxLevel}</p> : <div className="grid gap-1.5">
        <button type="button" className={buttonClass} disabled={pending || blocked !== null || !affordable} onClick={() => run(() => startStadiumUpgradeAction(key))}>{level ? text.upgradeCost(nextCost) : text.buildCost(nextCost)}</button>
        {"cost" in plan ? <p className={`text-xs ${affordable ? "text-white/55" : "text-rose-300"}`}>{affordable ? text.takes(duration(plan.minutes * 60)) : text.errors.no_money}</p>
          : blocked === "klubbhus_low" ? <p className="text-xs text-amber-300">{text.needsClubhouse(plan.minKlubbhus ?? 1)}</p>
          : blocked === "builders_busy" ? <p className="text-xs text-amber-300">{text.errors.builders_busy}</p> : null}
      </div>}
    </section>;
  };

  /** Speideren: send ut, vent, åpne og velg mellom pakka og spilleren. */
  function scoutArea(): ReactNode {
    const current = state.scout;
    if (scout === "none" || !current) return <button type="button" className={buttonClass} disabled={pending} onClick={() => run(sendScoutAction)}>{text.scoutSend}</button>;
    if (scout === "away") return <div className="grid gap-2 rounded-lg bg-white/5 p-3"><p className="text-sm font-bold">{text.scoutAway(duration(secondsLeft(current.endsAt, now)))}</p><Bar value={1 - secondsLeft(current.endsAt, now) / Math.max(1, (current.endsAt.getTime() - current.startedAt.getTime()) / 1000)} color={look.speiderhytte.color} /></div>;
    if (scout === "back" || !current.offer) return <div className="grid gap-2 rounded-lg bg-white/5 p-3"><p className="text-sm font-bold text-teal-300">{text.scoutBack}</p><button type="button" className={buttonClass} disabled={pending} onClick={() => run(openScoutAction)}>{text.scoutOpen}</button></div>;
    const offer = current.offer; const player = offer.player;
    return <div className="grid gap-3 rounded-lg bg-white/5 p-3">
      <p className="text-sm font-bold text-teal-300">{player ? text.scoutChoose : text.scoutNoPlayer}</p>
      <div className={`grid gap-3 ${player ? "sm:grid-cols-2" : ""}`}>
        {player ? <div className="grid content-start gap-2">
          <PlayerCardFace player={{ slug: player.slug, name: player.name, position: player.position, overall: player.overall, accent: player.accent, club: player.club, attributes: player.attributes }} />
          <button type="button" className={buttonClass} disabled={pending || budget < player.price} onClick={() => run(() => chooseScoutAction("player"))}>{text.scoutBuyBtn(player.price)}</button>
          {budget < player.price ? <p className="text-xs text-rose-300">{text.errors.no_money}</p> : null}
        </div> : null}
        <div className="grid content-start gap-2 rounded-xl border border-white/15 bg-slate-950/60 p-4">
          <p className="text-3xl">🎁</p>
          <p className="text-sm font-black">{text.scoutPackIs(t.market.packs.name(offer.packKey, offer.packKey))}</p>
          <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => run(() => chooseScoutAction("pack"))}>{text.scoutPackBtn}</button>
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
      <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1.5 text-sky-200">🏟️ {text.capacity(spaced(seatsOf(levels)))}</span>
      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">🔨 {text.builders(running.length, builderCount)}</span>
      {running.map((upgrade) => <button key={upgrade.building} type="button" onClick={() => setSelected(upgrade.building)} className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-amber-200">{look[upgrade.building].icon} {text.buildings[upgrade.building].name} · {duration(secondsLeft(upgrade.endsAt, now))}</button>)}
      {Array.from({ length: Math.max(0, builderCount - running.length) }, (_, index) => <span key={index} className="rounded-full border border-dashed border-white/25 px-3 py-1.5 text-white/55">{text.builderFree}</span>)}
    </div>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-start">
      <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-xl" style={{ aspectRatio: `${SCENE_W} / ${SCENE_H}` }}>
        <StadiumScene levels={levels} building={running.map((upgrade) => upgrade.building)} night={night || celebrate !== null} celebrate={celebrate !== null} />
        <button type="button" aria-pressed={night} aria-label={night ? text.lightsOff : text.lightsOn} title={night ? text.lightsOff : text.lightsOn} onClick={toggleNight} className="absolute left-2 top-2 z-20 grid size-9 place-items-center rounded-full border border-white/25 bg-slate-950/70 text-lg shadow transition hover:bg-slate-900">{night ? "☀️" : "🌙"}</button>
        {buildingKeys.map(tile)}
        {celebrate !== null ? <Celebration level={celebrate} seats={spaced(seatsOf(levels))} onDone={closeCelebration} /> : null}
      </div>

      <div className="grid gap-3 lg:sticky lg:top-4">
        {error ? <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm font-bold text-rose-200">{error}</p> : null}
        {selected ? sheet(selected) : <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/65">{text.tapHint}</p>}
      </div>
    </div>
  </div>;
}
