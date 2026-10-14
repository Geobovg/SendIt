"use client";

import { useT } from "@/i18n/client";
import { MAX_TEAM_CHEMISTRY } from "@/lib/chemistry";

const dotColors = ["bg-rose-400", "bg-amber-300", "bg-lime-300", "bg-emerald-400"];

/**
 * Tre prikker for kjemien til én spiller, fylt etter poeng. På kort (`unit="cqw"`) skalerer de med kortbredden,
 * ellers (`unit="px"`) er de små og faste.
 */
export function ChemDots({ points, unit = "px", className = "" }: { points: number; unit?: "cqw" | "px"; className?: string }) {
  const text = useT().chemistry;
  const size = unit === "cqw" ? "h-[6cqw] w-[6cqw]" : "h-2 w-2";
  return <span className={`inline-flex items-center ${unit === "px" ? "gap-1" : "gap-[2cqw]"} ${className}`} role="img" aria-label={text.player(points)} title={text.player(points)}>
    {[0, 1, 2].map((index) => <span key={index} className={`${size} rounded-full ring-1 ring-black/50 ${index < points ? dotColors[points] : "bg-black/50"}`} />)}
  </span>;
}

/** Kjemien til hele laget, f.eks. «Kjemi 24/33». `fixedRating` brukes for AI-lag som har en fast kjemi i stedet. */
export function TeamChemistry({ total, fixedRating = null, className = "" }: { total: number; fixedRating?: number | null; className?: string }) {
  const text = useT().chemistry;
  const label = fixedRating !== null ? text.fixed(fixedRating) : text.team(total, MAX_TEAM_CHEMISTRY);
  const level = total >= 27 ? 3 : total >= 17 ? 2 : total >= 8 ? 1 : 0;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-xs font-black ${className}`} title={text.hint}>
    <span className={`h-2 w-2 rounded-full ${fixedRating !== null ? "bg-lime-300" : dotColors[level]}`} />{label}
  </span>;
}
