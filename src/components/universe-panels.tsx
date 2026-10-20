"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/client";
import { arenaOf } from "@/lib/arenas";
import { acknowledgeUniverseAction } from "@/lib/universe-actions";
import { StadiumIllustration } from "./arena-scene";
import { useScrollLock } from "./use-scroll-lock";

/** Brukeren står alltid på sin første arena og i divisjon 10 når et nytt univers begynner. */
const START_DIVISION = 10;

/**
 * Animasjonen når du har vunnet Camp Nou: laget arkiveres, du reiser gjennom en portal og lander i neste univers.
 * Vises første gang du åpner managerkarrieren etter flyttingen (ikke midt i en kamp), og ikke igjen etter at du har trykket på knappen.
 */
export function UniverseTransition({ from, to }: { from: number; to: number }) {
  const t = useT().universe.transition;
  const pathname = usePathname();
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [closed, setClosed] = useState(false);
  const [pending, startTransition] = useTransition();
  const hidden = closed || pathname.startsWith("/managerkarriere/kamp");
  // Portalen trenger document, så den vises først i nettleseren.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  useScrollLock(!hidden);
  useEffect(() => {
    if (hidden) return;
    const warp = window.setTimeout(() => setPhase(1), 2800);
    const arrive = window.setTimeout(() => setPhase(2), 6200);
    return () => { window.clearTimeout(warp); window.clearTimeout(arrive); };
  }, [hidden]);
  if (hidden || !mounted) return null;
  const oldArena = arenaOf(5, from);
  const newArena = arenaOf(1, to);
  const color = phase === 2 ? newArena.colors.primary : oldArena.colors.primary;
  const enter = () => startTransition(async () => { await acknowledgeUniverseAction(); setClosed(true); });
  return createPortal(<div className="universe-stage" role="dialog" aria-modal="true" aria-label={t.eyebrow} style={{ "--universe-color": color } as React.CSSProperties}>
    <div className="universe-warp" data-on={phase >= 1} />
    {[0, 0.8, 1.6].map((delay) => <div key={delay} className="universe-ring" style={{ "--delay": `${delay}s` } as React.CSSProperties} />)}
    {phase === 0 ? <div key="old" className="universe-content universe-swap">
      <p className="text-xs font-black tracking-[.34em]" style={{ color }}>{t.eyebrow}</p>
      <StadiumIllustration arena={5} universe={from} className="h-36 w-full" />
      <h2 className="text-3xl font-black italic">{t.headline(oldArena.name)}</h2>
      <p className="text-sm text-white/75">{t.saving(from)}</p>
    </div> : null}
    {phase === 1 ? <div key="warp" className="universe-content universe-swap">
      <p className="text-2xl font-black italic tracking-wide">{t.travelling(to)}</p>
    </div> : null}
    {phase === 2 ? <div key="new" className="universe-content universe-swap">
      <p className="text-xs font-black tracking-[.34em]" style={{ color }}>{`${t.eyebrow} · ${to}`}</p>
      <StadiumIllustration arena={1} universe={to} className="h-36 w-full" />
      <h2 className="text-3xl font-black italic">{newArena.name}</h2>
      <p className="text-sm text-white/80">{t.freshStart(to, newArena.name, START_DIVISION)}</p>
      <p className="text-xs text-white/55">{t.keeps}</p>
      <button type="button" disabled={pending} onClick={enter} className="rounded-xl px-6 py-3 font-black text-slate-950 disabled:opacity-60" style={{ background: color }}>{t.button(to)}</button>
    </div> : null}
  </div>, document.body);
}

/**
 * Bytter mellom universet du spiller i og de gamle, som bare kan ses. Vises bare om du har et arkivert univers.
 * `viewing` er arkivet du ser på akkurat nå: da er «Du er her» på det arkivet, og universet ditt blir en lenke tilbake.
 */
export function UniverseBar({ current, archives, viewing }: { current: number; archives: { universe: number }[]; viewing?: number }) {
  const t = useT().universe.bar;
  if (!archives.length) return null;
  const chip = "rounded-full border px-3 py-1.5 text-xs font-black tracking-wider";
  const active = `${chip} border-lime-300/60 bg-lime-300 text-slate-950`;
  const idle = `${chip} border-white/15 bg-white/5 text-white/75 transition hover:border-white/40`;
  return <nav className="flex flex-wrap items-center gap-2" aria-label={t.label(viewing ?? current)}>
    {viewing === undefined
      ? <span className={active}>{t.label(current)} · {t.here}</span>
      : <Link href="/managerkarriere" className={idle}>{t.label(current)}</Link>}
    {archives.map((archive) => archive.universe === viewing
      ? <span key={archive.universe} aria-current="page" className={active}>{t.viewArchive(archive.universe)}</span>
      : <Link key={archive.universe} href={`/managerkarriere/univers/${archive.universe}`} className={idle}>{t.viewArchive(archive.universe)}</Link>)}
  </nav>;
}
