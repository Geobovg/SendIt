"use client";

import { useT } from "@/i18n/client";
import type { InformCard } from "@/lib/career";
import { specialStyles } from "@/lib/special-cards";
import { PlayerCardFace } from "./player-card-face";

/** Alle Inner Peace-kortene i den nyeste runden (migrering 0116 og 0122), sortert etter rating, med løftet fra vanlig-kortet. */
export function InnerPeaceGallery({ cards }: { cards: InformCard[] }) {
  const t = useT(); const th = t.career.innerPeace; const style = specialStyles.inner_peace;
  return <div className="grid gap-5">
    <div className="rounded-xl border-2 p-4 text-white" style={{ background: style.background, borderColor: style.border }}>
      <p className="text-xs font-black tracking-[.3em]" style={{ color: style.badge }}>★ {t.career.special.name.inner_peace}</p>
      <p className="mt-1 text-sm text-white/80">{th.intro(cards.length)}</p>
    </div>
    {cards.length ? <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
      {cards.map((card) => <li key={card.id} className="grid gap-1">
        <PlayerCardFace player={card} className="h-full" />
        <p className="text-center text-xs font-bold" style={{ color: style.glow }}>{th.boost(card.boost)}</p>
      </li>)}
    </ul> : <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">{th.empty}</p>}
  </div>;
}
