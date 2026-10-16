"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { PickCard, SpecialPickView } from "@/lib/career";
import { claimPlayerPickAction, claimSpecialPickAction } from "@/lib/manager-actions";
import { specialStyles } from "@/lib/special-cards";
import { useT } from "@/i18n/client";
import { ConfirmDialog } from "./confirm-dialog";
import { PlayerCardFace } from "./player-card-face";
import { buttonClass } from "./ui";
import { useScrollLock } from "./use-scroll-lock";

/** «special» er et spillervalg med spesialkort (0102), «player» et med vanlige spillere (0114). */
type PickKind = "special" | "player";

const faceOf = (card: PickCard) => ({ slug: card.slug ?? "", name: card.name, position: card.position, overall: card.overall, accent: card.accent ?? "#35d06a", club: card.club ?? "", attributes: card.attributes, special: card.special });

function PickDialog({ pick, kind, onClose }: { pick: SpecialPickView; kind: PickKind; onClose: () => void }) {
  const t = useT().market;
  const tp = kind === "player" ? { ...t.pick, ...t.playerPick } : t.pick;
  const router = useRouter();
  const [selected, setSelected] = useState<PickCard | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<{ name: string; location: "squad" | "storage"; card: PickCard } | null>(null);
  const [pending, startTransition] = useTransition();
  useScrollLock();

  const choose = (card: PickCard) => {
    setConfirming(false); setError(null);
    startTransition(async () => {
      const result = await (kind === "player" ? claimPlayerPickAction : claimSpecialPickAction)(pick.id, card.id);
      if (result.error || !result.pull) { setError(result.error ?? tp.errors.notFound); return; }
      setReceived({ name: card.name, location: result.pull.location, card });
    });
  };
  const close = () => { onClose(); router.refresh(); };

  return createPortal(<div className="pack-stage" role="dialog" aria-modal="true" aria-label={tp.title}>
    <div className="grid max-h-full w-full max-w-5xl gap-4 overflow-y-auto">
      <div className="text-center text-white">
        <p className="text-xs font-bold tracking-[.3em] text-white/60">{tp.eyebrow}</p>
        <h2 className="mt-1 text-3xl font-black">{received ? tp.received(received.name) : tp.title}</h2>
        <p className="mt-1 text-sm text-white/70">{received ? (received.location === "squad" ? tp.inSquad : tp.inStorage) : tp.intro}</p>
      </div>
      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
      {received ? <div className="grid justify-items-center gap-4">
        <div className="w-72"><PlayerCardFace player={faceOf(received.card)} eager /></div>
        <button type="button" className={buttonClass} onClick={close}>{tp.close}</button>
      </div> : <>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
          {pick.options.map((card) => <div key={card.id} className="grid w-56 shrink-0 snap-center content-start gap-2 sm:w-auto">
            <button type="button" aria-pressed={selected?.id === card.id} disabled={pending} onClick={() => setSelected(card)} className="rounded-2xl text-left" style={selected?.id === card.id ? { outline: `3px solid ${card.special ? specialStyles[card.special].glow : "#35d06a"}`, outlineOffset: 3 } : undefined}><PlayerCardFace player={faceOf(card)} eager /></button>
            {selected?.id === card.id ? <button type="button" className={`${buttonClass} justify-self-center`} disabled={pending} onClick={() => setConfirming(true)}>{pending ? tp.choosing : tp.choose}</button> : null}
          </div>)}
        </div>
      </>}
    </div>
    {confirming && selected ? <ConfirmDialog message={tp.confirm(selected.name)} onCancel={() => setConfirming(false)} onConfirm={() => choose(selected)} /> : null}
  </div>, document.body);
}

/** Gratis spillervalg: fem spesialkort, velg ett. Vises øverst i pakkebutikken til det er brukt. */
export function SpecialPick({ pick, kind }: { pick: SpecialPickView; kind: PickKind }) {
  const t = useT().market;
  const tp = kind === "player" ? { ...t.pick, ...t.playerPick } : t.pick;
  const [open, setOpen] = useState(false);
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4" style={{ borderColor: specialStyles.inform.border, background: specialStyles.inform.background, color: "white" }}>
    <div className="min-w-0">
      <p className="text-xs font-black tracking-[.22em]" style={{ color: specialStyles.inform.badge }}>★ {tp.eyebrow}</p>
      <h3 className="text-lg font-black">{tp.taskTitle}</h3>
      <p className="text-sm text-white/70">{tp.intro}</p>
    </div>
    <button type="button" className={buttonClass} onClick={() => setOpen(true)}>{tp.open}</button>
    {open ? <PickDialog pick={pick} kind={kind} onClose={() => setOpen(false)} /> : null}
  </div>;
}
