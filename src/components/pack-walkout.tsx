"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useT } from "@/i18n/client";
import type { PackPull } from "@/lib/manager-actions";
import { playerFlag } from "@/lib/player-nationalities";
import { playerPhoto } from "@/lib/player-photos";

// Grensa for det store trekket. Alt herfra og opp får walkout slik som i FIFA.
export const walkoutFrom = 86;

// Et spesialkort får alltid walkout, uansett rating.
export function qualifiesForWalkout(pull: PackPull) {
  return pull.overall >= walkoutFrom || Boolean(pull.special);
}

// 90+ og ikoner får en lengre og mørkere walkout enn de vanlige 86–89.
export function isEpicWalkout(pull: PackPull) {
  return pull.overall >= 90 || pull.special === "icon";
}

// Hvor lenge spilleren går før kortet vises. Navnet kommer først helt på slutten.
export function walkMs(pull: PackPull) {
  return isEpicWalkout(pull) ? 5600 : 3800;
}

// Flagget til spillerens nasjon, stort på hver sin side av skjermen mens kortet åpnes.
// Uten flagg (f.eks. personlige kort) brukes bare lysfargen.
export function WalkoutFlags({ slug, glow, leaving }: { slug: string; glow: string; leaving: boolean }) {
  const flag = playerFlag(slug);
  const style = { "--pack-glow": glow, ...(flag ? { "--flag": `url(${flag})` } : {}) } as CSSProperties;
  return <div aria-hidden className={`walkout-flags ${leaving ? "walkout-flags-out" : ""}`} style={style}>
    <div className="walkout-flag walkout-flag-left" />
    <div className="walkout-flag walkout-flag-right" />
  </div>;
}

// Spilleren går mot kameraet som en mørk silhuett med lysrand, og blir først lyst opp helt på slutten.
export function WalkoutFigure({ pull, glow }: { pull: PackPull; glow: string }) {
  const t = useT();
  const photo = playerPhoto(pull.slug);
  const epic = isEpicWalkout(pull);
  const style = { "--pack-glow": glow, "--walk-ms": `${walkMs(pull)}ms` } as CSSProperties;
  return <div className={`walkout-scene ${epic ? "walkout-epic" : ""}`} style={style}>
    <div className="walkout-door" />
    {epic ? <div className="walkout-pulse" /> : null}
    <div className="walkout-bob">
      {photo
        ? <Image src={photo} alt="" width={256} height={256} priority className="walkout-figure" />
        : <div className="walkout-figure grid place-items-center text-8xl font-black text-white">{pull.position}</div>}
    </div>
    <div className="walkout-label text-center text-white">
      <p className="text-2xl font-black uppercase tracking-wide">{pull.name}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[.2em] text-white/70">{t.career.clubName(pull.club)}</p>
    </div>
  </div>;
}
