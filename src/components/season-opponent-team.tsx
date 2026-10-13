"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { anyPosition, formationNames, formations, type Formation } from "@/lib/lineup";
import type { ManagerPlayerSnapshot } from "@/lib/manager-match";
import { playerPhoto } from "@/lib/player-photos";
import { seasonOpponentTeamAction, type SeasonOpponentTeam } from "@/lib/season-actions";
import { PitchMarkings, slotPoint } from "./squad-pitch";
import { useScrollLock } from "./use-scroll-lock";

/** Et lite spillerkort som bare vises, uten noe å trykke på. */
function TeamCard({ player }: { player: ManagerPlayerSnapshot }) {
  const anyLabel = useT().career.special.anyPosition;
  const photo = player.slug ? playerPhoto(player.slug) : null;
  // Som i lagtroppen: lange navn vises uten fornavn.
  const shortName = player.name.length > 13 && player.name.includes(" ") ? player.name.slice(player.name.indexOf(" ") + 1) : player.name;
  return <div className="@container relative aspect-[100/136] w-full overflow-hidden rounded-[9%/7%] border-2 border-amber-200/80 text-white shadow-[0_8px_18px_rgba(0,0,0,.45)]" style={{ background: `radial-gradient(circle at 85% 0%, ${player.accent ?? "#d3a13a"}cc, transparent 45%), linear-gradient(160deg, #f3d57a 0%, #d3a13a 30%, #8a5a17 70%, #3a230c 100%)` }}>
    {photo ? <Image src={photo} alt="" width={256} height={256} className="pointer-events-none absolute bottom-[21%] right-[-12%] h-[90cqw] w-[90cqw] object-contain object-bottom drop-shadow-[0_6px_6px_rgba(0,0,0,.45)]" /> : <span className="absolute bottom-[30%] right-[12%] text-[34cqw] leading-none opacity-80">⚽</span>}
    <span className="absolute left-[6cqw] top-[6cqw] flex w-[24cqw] flex-col items-center gap-[2.5cqw] drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">
      <b className={`${player.overall >= 100 ? "text-[19cqw]" : "text-[27cqw]"} font-black leading-[.85] tracking-tighter`}>{player.overall}</b>
      <span className="text-[max(7px,12cqw)] font-black leading-none tracking-wide">{player.position === anyPosition ? anyLabel : player.position}</span>
    </span>
    <span className="absolute inset-x-0 bottom-0 flex h-[21%] items-center justify-center border-t border-white/40 bg-black/45 px-[5cqw]"><b className="truncate text-[max(7px,10cqw)] font-black uppercase leading-none tracking-wide">{shortName}</b></span>
  </div>;
}

/** Vinduet som viser laget til en motstander i AI-sesongen, slik du møter det i kampen. */
export function OpponentTeamDialog({ teamKey, onClose }: { teamKey: string; onClose: () => void }) {
  const t = useT();
  const [team, setTeam] = useState<SeasonOpponentTeam | { error: string } | null>(null);
  useScrollLock();
  useEffect(() => {
    let current = true;
    seasonOpponentTeamAction(teamKey).then((result) => { if (current) setTeam(result); }).catch(() => { if (current) setTeam({ error: t.seasons.errors.opponentNotFound }); });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { current = false; window.removeEventListener("keydown", onKey); };
  }, [teamKey, onClose, t]);
  const loaded = team && !("error" in team) ? team : null;
  const slots = loaded ? formations[formationNames.includes(loaded.formation as Formation) ? (loaded.formation as Formation) : "4-3-3"] : [];
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" className="grid w-full max-w-2xl gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-5" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black">{loaded?.name ?? ""}</h3>
          {loaded ? <p className="text-xs text-white/50">{loaded.formation} · {loaded.userTeam ? t.seasons.team.scaled : t.seasons.team.ai}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-black hover:bg-white/20">{t.seasons.team.close}</button>
      </div>
      {!team ? <p className="py-10 text-center text-sm text-white/60">{t.seasons.team.loading}</p> : "error" in team ? <p className="py-10 text-center text-sm text-rose-300">{team.error}</p> : <>
        <div className="@container relative aspect-[1000/900] overflow-hidden rounded-2xl border border-emerald-200/25 bg-[#062a1d] shadow-[inset_0_0_90px_rgba(0,0,0,.6)]">
          <PitchMarkings layout="wide" />
          {team.starters.map((player, index) => { const point = slotPoint(slots[index] ?? { x: 50, y: 50 }, "wide"); return <div key={player.id} className="absolute w-[clamp(44px,12.5cqw,110px)] -translate-x-1/2 -translate-y-1/2" style={{ left: point.left, top: point.top }}><TeamCard player={player} /></div>; })}
        </div>
        {team.bench.length ? <div className="grid gap-2">
          <p className="text-[10px] font-black tracking-widest text-white/45">{t.seasons.team.bench}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{team.bench.map((player) => <TeamCard key={player.id} player={player} />)}</div>
        </div> : null}
      </>}
    </div>
  </div>;
}
