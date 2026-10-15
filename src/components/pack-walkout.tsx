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

// Spilleren går først mot kameraet og feirer deretter. Kortet vises når feiringen er over.
export function walkTiming(pull: PackPull) {
  const epic = isEpicWalkout(pull);
  const approach = epic ? 4200 : 3000;
  const celebrate = epic ? 2200 : 1800;
  return { approach, celebrate, total: approach + celebrate };
}

export function walkMs(pull: PackPull) {
  return walkTiming(pull).total;
}

// Vi har bare ett stillbilde per spiller, så feiringen er en bevegelse av hele kroppen.
// Signaturfeiringene ligger her; alle andre får en knyttneve-feiring.
//   siu: hopp med snurr og armene ut (Ronaldo)   crouch: setter seg ned (meditasjon, bønn)
//   wide: strekker seg ut med armene ut           bounce: danser
//   pose: stopper og stiller seg opp
export type Celebration = "siu" | "crouch" | "wide" | "bounce" | "pose" | "pump";

const celebrations: Record<string, Celebration> = {
  "cristiano-ronaldo": "siu",
  haaland: "crouch",
  salah: "crouch",
  bellingham: "wide",
  "jobe-bellingham": "wide",
  "antoine-griezmann": "bounce",
  neymar: "bounce",
  "lamine-yamal": "bounce",
  vinicius: "bounce",
  mbappe: "pose",
  messi: "pose",
  kane: "pose",
};

export function celebrationFor(slug: string): Celebration {
  return celebrations[slug] ?? "pump";
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

// Spilleren går mot kameraet i skygge, blir lyst opp underveis og feirer til slutt.
export function WalkoutFigure({ pull, glow }: { pull: PackPull; glow: string }) {
  const t = useT();
  const photo = playerPhoto(pull.slug);
  const epic = isEpicWalkout(pull);
  const { approach, celebrate, total } = walkTiming(pull);
  // Antall halve skritt mens han går, alltid et partall så han står rett når han stopper.
  const steps = Math.max(2, 2 * Math.round(approach / 1200));
  const style = { "--pack-glow": glow, "--walk-ms": `${total}ms`, "--approach-ms": `${approach}ms`, "--celebrate-ms": `${celebrate}ms`, "--steps": steps } as CSSProperties;
  return <div className={`walkout-scene ${epic ? "walkout-epic" : ""}`} style={style}>
    <div className="walkout-door" />
    {epic ? <div className="walkout-pulse" /> : null}
    <div className="walkout-shadow" />
    <div className={`walkout-celebrate walkout-c-${celebrationFor(pull.slug)}`}>
      <div className="walkout-bob">
        {photo
          ? <Image src={photo} alt="" width={256} height={256} priority className="walkout-figure" />
          : <div className="walkout-figure grid place-items-center text-8xl font-black text-white">{pull.position}</div>}
      </div>
    </div>
    <div className="walkout-label text-center text-white">
      <p className="text-2xl font-black uppercase tracking-wide">{pull.name}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[.2em] text-white/70">{t.career.clubName(pull.club)}</p>
    </div>
  </div>;
}
