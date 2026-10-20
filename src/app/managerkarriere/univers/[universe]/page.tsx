import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StadiumIllustration } from "@/components/arena-scene";
import { PlayerCardFace } from "@/components/player-card-face";
import { UniverseBar } from "@/components/universe-panels";
import { sessionUserId } from "@/lib/auth";
import { arenaBackground, arenaOf } from "@/lib/arenas";
import { getUniverseArchive, getUniverseNav, type ArchivedCard } from "@/lib/universe";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

// Et lukket univers: laget og statistikken slik de sto, uten noen knapper for å spille.
export default async function UniverseArchivePage({ params }: { params: Promise<{ universe: string }> }) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const number = Number((await params).universe);
  if (!Number.isInteger(number) || number < 1) notFound();
  const [archive, nav, t] = await Promise.all([getUniverseArchive(userId, number), getUniverseNav(userId), getT()]);
  if (!archive) notFound();
  const text = t.universe.archive;
  const { snapshot } = archive;
  const peak = snapshot.seasons.reduce((best, season) => Math.max(best, season.arena), 1);
  const arena = arenaOf(peak, number);
  const stats: [string, string][] = [
    [text.stats.rating, String(snapshot.rating ?? "–")],
    [text.stats.record, `${snapshot.wins} / ${snapshot.draws} / ${snapshot.losses}`],
    [text.stats.cards, String(snapshot.card_count)],
    [text.stats.earned, String(snapshot.budget_earned)],
    [text.stats.formation, snapshot.formation ?? "–"],
    [text.stats.xp, String(snapshot.club_xp)],
  ];
  const cards = (list: ArchivedCard[]) => <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{list.map((card, index) => <PlayerCardFace key={index} player={{ ...card, altPositions: card.altPositions ?? [] }} className="!min-h-[22rem]" />)}</div>;
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <UniverseBar current={nav.current} archives={nav.archives} />
    <section className="relative overflow-hidden rounded-2xl border p-5 shadow-2xl sm:p-7" style={{ background: arenaBackground(peak, number), borderColor: `${arena.colors.primary}40` }}>
      <StadiumIllustration arena={peak} universe={number} className="pointer-events-none absolute -right-6 top-0 h-40 w-80 opacity-40" />
      <div className="relative grid gap-3">
        <p className="text-xs font-black tracking-[.25em]" style={{ color: arena.colors.primary }}>{text.eyebrow(number)}</p>
        <h1 className="text-4xl font-black italic tracking-tight sm:text-5xl">{text.title(snapshot.club_name)}</h1>
        <p className="max-w-xl rounded-lg bg-black/35 px-3 py-2 text-sm text-white/75">{text.readOnly}</p>
        <Link href="/managerkarriere" className="justify-self-start text-sm font-black" style={{ color: arena.colors.primary }}>← {text.back}</Link>
      </div>
    </section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-slate-900/75 p-3"><p className="text-[10px] font-black tracking-widest text-white/45">{label.toUpperCase()}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}
    </section>
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/75 p-4">
      <h2 className="text-lg font-black">{text.seasons}</h2>
      <ul className="grid gap-1.5">{snapshot.seasons.map((season) => <li key={season.season_number} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/25 px-3 py-2 text-sm">
        <span className="font-bold">{text.season(season.season_number)} · {arenaOf(season.arena, number).name} · {t.seasons.division(season.division)}</span>
        <span className={season.outcome === "champion" ? "font-black text-amber-300" : "text-white/70"}>{text.position(season.final_position)}{season.outcome ? ` · ${text.outcome[season.outcome]}` : ""}</span>
      </li>)}</ul>
    </section>
    {snapshot.starters.length ? <section className="grid gap-3"><h2 className="text-lg font-black">{text.starters}</h2>{cards(snapshot.starters)}</section> : null}
    {snapshot.bench.length ? <section className="grid gap-3"><h2 className="text-lg font-black">{text.bench}</h2>{cards(snapshot.bench)}</section> : null}
  </div>;
}
