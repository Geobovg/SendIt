"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { ManagerPack, PackShop } from "@/lib/career";
import { specialStyles } from "@/lib/special-cards";
import { openManagerPackAction, quickSellPackCardsAction, type PackActionState, type PackPull, type QuickSellPackState } from "@/lib/manager-actions";
import { quickSellValue } from "@/lib/manager-limits";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { PlayerCardFace } from "./player-card-face";
import { ConfirmDialog } from "./confirm-dialog";
import { qualifiesForWalkout, walkMs, walkoutFrom, WalkoutBackdrop, WalkoutEmbers, WalkoutFigure, WalkoutFlags, WalkoutHandoff, WalkoutPreload } from "./pack-walkout";
import { SpecialPick } from "./special-pick";
import { buttonClass, cardClass, secondaryButtonClass } from "./ui";
import { useScrollLock } from "./use-scroll-lock";

const initial: PackActionState = {};
const initialQuickSell: QuickSellPackState = {};

// Selger kortene fra pakka som ikke er sendt til klubben. Akademikort (ikke omsettelige) blir liggende.
function QuickSellRest({ pulls, action, pending }: { pulls: PackPull[]; action: (formData: FormData) => void; pending: boolean }) {
  const tp = useT().market.packs;
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const payout = pulls.reduce((sum, pull) => sum + quickSellValue(pull.price, pull.special), 0);
  if (!pulls.length) return null;
  return <>
    <form ref={formRef} action={action}>
      {pulls.map((pull) => <input key={pull.card_id} type="hidden" name="card_id" value={pull.card_id} />)}
      <button type="button" className={`${secondaryButtonClass} shadow-lg`} disabled={pending} onClick={() => setConfirming(true)}>{pending ? tp.quickSellingAll : tp.quickSellAll(payout)}</button>
    </form>
    {confirming ? <ConfirmDialog message={tp.quickSellAllConfirm(pulls.length, payout)} onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); formRef.current?.requestSubmit(); }} /> : null}
  </>;
}

// Salgene legges sammen, og kort som allerede er solgt sendes ikke på nytt. Trykker man to ganger
// fort, kjøres det andre salget etter det første og ville ellers feilet med «Du eier ikke dette kortet».
async function quickSellOnce(prev: QuickSellPackState, formData: FormData): Promise<QuickSellPackState> {
  const already = new Set(prev.soldIds ?? []);
  const next = new FormData();
  for (const id of formData.getAll("card_id")) if (!already.has(String(id))) next.append("card_id", id);
  if (!next.has("card_id")) return prev;
  const result = await quickSellPackCardsAction(prev, next);
  return { ...result, soldIds: [...already, ...(result.soldIds ?? [])], payout: (prev.payout ?? 0) + (result.payout ?? 0) };
}
function glowFor(overall: number) {
  if (overall >= 90) return "#ff2fb0";
  if (overall >= walkoutFrom) return "#f2c94c";
  if (overall >= 82) return "#cfd6e4";
  return "#c08457";
}

function tierLabel(tier: { min: number; max: number }) {
  if (tier.max >= 99) return `${tier.min}+`;
  return tier.min === tier.max ? `${tier.min}` : `${tier.min}–${tier.max}`;
}

// Stjernesjansene er små, så de vises med flere desimaler i stedet for å rundes til 0,0 %.
function oddsLabel(percent: number, locale: Locale) {
  return percent.toLocaleString(INTL_LOCALES[locale], { maximumFractionDigits: percent < 1 ? 2 : 1 });
}

function PackOdds({ pack, informFactor }: { pack: ManagerPack; informFactor: number }) {
  const tp = useT().market.packs;
  const locale = useLocale();
  const total = pack.odds.reduce((sum, tier) => sum + tier.weight, 0);
  // Inform-sjansen gjelder hvert kort i pakka, og arenaen du er i løfter den litt.
  const inform = pack.inform_chance * informFactor * 100;
  const tots = pack.tots_chance * informFactor * 100;
  const icon = pack.icon_chance * informFactor * 100;
  const honorable = pack.honorable_chance * informFactor * 100;
  return <dl className="grid gap-1 text-xs">
    {[...pack.odds].reverse().map((tier) => <div key={tier.min} className="flex items-center justify-between gap-3">
      <dt className="text-muted">{tp.rating(tierLabel(tier))}</dt>
      <dd className="font-semibold tabular-nums">{tp.percent(oddsLabel(100 * tier.weight / total, locale))}</dd>
    </div>)}
    {/* Spesialkortet er et eget, garantert kort ved siden av kortene som trekkes etter sjansene over. */}
    {pack.special_guarantee ? <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
      <dt className="font-semibold" style={{ color: pack.special_scope === "tots" ? specialStyles.tots.glow : specialStyles.inform.border }}>{tp.specialGuarantee(pack.special_guarantee, pack.special_scope === "mix" ? "all" : pack.special_scope)}</dt>
      <dd className="font-semibold">{tp.guaranteed}</dd>
    </div> : null}
    {inform > 0 ? <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
      <dt className="font-semibold" style={{ color: specialStyles.inform.border }}>{tp.informOdds}</dt>
      <dd className="font-semibold tabular-nums">{tp.percent(oddsLabel(inform, locale))}</dd>
    </div> : null}
    {tots > 0 ? <div className="flex items-center justify-between gap-3">
      <dt className="font-semibold" style={{ color: specialStyles.tots.glow }}>{tp.totsOdds}</dt>
      <dd className="font-semibold tabular-nums">{tp.percent(oddsLabel(tots, locale))}</dd>
    </div> : null}
    {icon > 0 ? <div className="flex items-center justify-between gap-3">
      <dt className="font-semibold" style={{ color: specialStyles.icon.glow }}>{tp.iconOdds}</dt>
      <dd className="font-semibold tabular-nums">{tp.percent(oddsLabel(icon, locale))}</dd>
    </div> : null}
    {honorable > 0 ? <div className="flex items-center justify-between gap-3">
      <dt className="font-semibold" style={{ color: specialStyles.honorable.glow }}>{tp.honorableOdds}</dt>
      <dd className="font-semibold tabular-nums">{tp.percent(oddsLabel(honorable, locale))}</dd>
    </div> : null}
  </dl>;
}

// Ett steg i åpningen er ett vanlig kort, eller walkouten. Har pakka to eller flere walkouts,
// vises de to beste sist, som i FC: den laveste går ut først, så snur kortet seg og den beste kommer.
type RevealStep = { cards: PackPull[]; walkout: boolean };
type StageKind = "wait" | "walk" | "card" | "turn";

function buildSteps(pulls: PackPull[]): RevealStep[] {
  const best = pulls.filter(qualifiesForWalkout).sort((a, b) => b.overall - a.overall).slice(0, 2).reverse();
  const picked = new Set(best.map((pull) => pull.card_id));
  const steps: RevealStep[] = pulls.filter((pull) => !picked.has(pull.card_id)).map((pull) => ({ cards: [pull], walkout: false }));
  return best.length ? [...steps, { cards: best, walkout: true }] : steps;
}

// Stegene et kort går gjennom. Vanlige kort venter litt før de snus, en walkout går først.
function stageKinds(step: RevealStep): StageKind[] {
  if (!step.walkout) return ["wait", "card"];
  return step.cards.flatMap((_, i): StageKind[] => i ? ["turn", "walk", "card"] : ["walk", "card"]);
}

function PackReveal({ pulls, packName, jackpot, onClose }: { pulls: PackPull[]; packName: string; jackpot: number; onClose: () => void }) {
  const t = useT(); const tp = t.market.packs;
  // index -1 mens pakka ryker opp, deretter ett steg per kort (eller walkout), til slutt oppsummeringen.
  // Index og stage ligger i samme tilstand, slik at et nytt kort alltid starter
  // skjult uten at en effekt må nullstille noe.
  const steps = useMemo(() => buildSteps(pulls), [pulls]);
  const [phase, setPhase] = useState({ index: -1, stage: 0, skipped: false });
  const { index, stage, skipped } = phase;
  const step = index >= 0 && index < steps.length ? steps[index] : null;
  const kinds = step ? stageKinds(step) : [];
  const kind = kinds[stage];
  const lastStage = stage >= kinds.length - 1;
  // Walkouten har tre stegs per kort (gå, kort, snu), så kortnummeret er stage / 3.
  const cardIndex = step?.walkout ? Math.floor(stage / 3) : 0;
  const card = step?.cards[cardIndex] ?? null;
  const revealed = kind === "card" || kind === "turn";
  // Alle kort fra 86 og et inform-kort får den store animasjonen, men bare de to beste går ut av tunnelen.
  const walkout = card ? qualifiesForWalkout(card) : false;
  const glow = card?.special ? specialStyles[card.special].glow : glowFor(card?.overall ?? 0);

  useEffect(() => {
    if (index !== -1) return;
    const timer = setTimeout(() => setPhase({ index: 0, stage: 0, skipped: false }), 900);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    if (!card) return;
    // Bevegelse slått av: walkouten hoppes nesten over, kortet vises rett etter.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ms: number | null = null;
    if (kind === "wait") ms = walkout ? 1500 : 650;
    else if (kind === "walk") ms = reduced ? 600 : walkMs(card);
    else if (kind === "card" && !lastStage) ms = 2000;
    else if (kind === "turn") ms = 600;
    if (ms === null) return;
    const timer = setTimeout(() => setPhase((current) => ({ ...current, stage: current.stage + 1 })), ms);
    return () => clearTimeout(timer);
  }, [card, kind, lastStage, walkout, stage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Etter siste kort lukker en mørk skygge seg inn før oppsummeringen vises, så det ikke blir et brått hopp.
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setPhase({ index: steps.length, stage: 0, skipped: false });
      setClosing(false);
    }, 750);
    return () => clearTimeout(timer);
  }, [closing, steps.length]);

  const next = () => {
    if (kind !== "card" || closing) return;
    if (lastStage && index === steps.length - 1) { setClosing(true); return; }
    setPhase((current) => lastStage ? { index: current.index + 1, stage: 0, skipped: false } : { ...current, stage: current.stage + 1 });
  };
  // Hopp over går rett til siste kort i walkouten, uten flagg og gåing.
  const skip = () => setPhase((current) => ({ ...current, stage: kinds.length - 1, skipped: true }));
  const done = index >= steps.length;
  const shown = steps.slice(0, Math.max(index, 0)).reduce((sum, previous) => sum + previous.cards.length, 0) + cardIndex + 1;
  const best = pulls.reduce((top, pull) => Math.max(top, pull.overall), 0);
  const [sellState, sellAction, sellPending] = useActionState(quickSellOnce, initialQuickSell);
  const soldIds = new Set(sellState.soldIds ?? []);
  // Trykker man på et kort, kan man sende det til klubben. Da blir det ikke med i «Hurtigselg alle».
  // Kortene ligger allerede i klubben, så dette skjer bare her i nettleseren.
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmingKeep, setConfirmingKeep] = useState<PackPull | null>(null);
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const sellable = pulls.filter((pull) => (pull.tradable || pull.special) && !soldIds.has(pull.card_id));
  const toSell = sellable.filter((pull) => !kept.has(pull.card_id));
  useScrollLock();

  // Portal til body: butikken ligger i et kort med backdrop-blur, og da ville «fixed» blitt
  // regnet fra kortet i stedet for skjermen, så man måtte bla opp for å se pakka.
  return createPortal(<div className="pack-stage" role="dialog" aria-modal="true" aria-label={tp.opening(packName)}>
    {/* Alle kortene i pakka tegnes usynlig med en gang, så bilde, flagg og klubbmerke
        lastes ned mens pakka ryker opp og ligger klare når hvert kort snus. */}
    {done ? null : <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 w-72 overflow-hidden">
      {pulls.map((pull) => <PlayerCardFace key={pull.card_id} player={pull} eager />)}
      <WalkoutPreload pulls={pulls} />
    </div>}
    {done ? <div className="grid max-h-full w-full max-w-4xl gap-4 overflow-y-auto">
      <div className="pack-summary-rise text-center text-white" style={{ "--i": 0 } as CSSProperties}>
        <p className="text-xs font-bold tracking-[.3em] text-white/60">{packName.toUpperCase()}</p>
        <h2 className="mt-1 text-3xl font-black">{tp.youGot(pulls.length)}</h2>
        <p className="mt-1 text-sm text-white/70">{tp.bestCard(best)}</p>
        {jackpot ? <p className="pack-label-rise mx-auto mt-3 w-fit rounded-xl border-2 px-5 py-3 text-2xl font-black" style={{ borderColor: specialStyles.personal.border, color: specialStyles.personal.badge, background: "rgba(0,0,0,.45)" }}>{tp.jackpot(jackpot)}</p> : null}
      </div>
      {/* Knappen står øverst og blir liggende når man ruller, så man slipper å bla ned for å gå videre. */}
      <div className="pack-summary-rise sticky top-0 z-10 flex flex-wrap justify-center gap-2 py-1" style={{ "--i": 1 } as CSSProperties}><button className={`${buttonClass} shadow-lg`} onClick={onClose}>{tp.done}</button><QuickSellRest pulls={toSell} action={sellAction} pending={sellPending} /></div>
      {toSell.length ? <p className="text-center text-sm text-white/70">{tp.pickToKeep}</p> : null}
      {sellState.soldIds?.length ? <p className="text-center text-sm font-semibold text-white">{tp.quickSoldAll(sellState.soldIds.length, sellState.payout ?? 0)}</p> : null}
      {sellState.error ? <p className="text-center text-sm text-danger">{sellState.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pulls.map((pull, i) => {
          const sold = soldIds.has(pull.card_id);
          const sent = kept.has(pull.card_id);
          const canSend = !sold && !sent && (pull.tradable || Boolean(pull.special));
          const status = sold ? tp.sold : sent ? tp.sentToClub : <>{pull.location === "storage" ? tp.toStorage : tp.inSquad}{pull.duplicate ? tp.duplicate : ""}{pull.tradable ? "" : tp.untradable}</>;
          return <div key={pull.card_id} className={`pack-summary-rise grid gap-1 ${sold ? "opacity-40" : ""}`} style={{ "--i": i + 2 } as CSSProperties}>
            {canSend ? <button type="button" aria-expanded={picked === pull.card_id} onClick={() => setPicked((current) => current === pull.card_id ? null : pull.card_id)} className={`rounded-2xl text-left ${picked === pull.card_id ? "ring-2 ring-accent" : ""}`}><PlayerCardFace player={pull} eager /></button> : <PlayerCardFace player={pull} eager />}
            {canSend && picked === pull.card_id ? <button type="button" className={`${buttonClass} justify-self-center`} onClick={() => setConfirmingKeep(pull)}>{tp.sendToClub}</button> : null}
            <p className={`text-center text-xs ${sent ? "font-semibold text-emerald-300" : "text-white/70"}`}>{status}</p>
          </div>;
        })}
      </div>
      {confirmingKeep ? <ConfirmDialog message={tp.sendToClubConfirm(confirmingKeep.name)} onCancel={() => setConfirmingKeep(null)} onConfirm={() => { setKept((current) => new Set(current).add(confirmingKeep.card_id)); setConfirmingKeep(null); setPicked(null); }} /> : null}
    </div> : <>
    {/* Flaggene ligger bak kortet og tones ut når kortet er åpnet. */}
    {step?.walkout && card && !skipped && (kind === "walk" || kind === "card") ? <WalkoutFlags slug={card.slug} glow={glow} leaving={kind === "card"} /> : null}
    {step?.walkout && card && !skipped && (kind === "walk" || kind === "card") ? <WalkoutBackdrop key={`lys-${card.card_id}`} pull={card} glow={glow} leaving={kind === "card"} /> : null}
    {step?.walkout && card && !skipped && kind === "card" ? <WalkoutEmbers key={`gnister-${card.card_id}`} glow={glow} /> : null}
    <button type="button" onClick={next} className="absolute inset-0 grid place-items-center focus:outline-none" aria-label={kind === "card" ? tp.nextCard : tp.openingCard}>
      <div className={kind === "card" && walkout && !skipped && !step?.walkout ? "pack-shake relative grid place-items-center" : "relative grid place-items-center"}>
        {card ? <div className="pack-rays" style={{ "--pack-glow": glow } as CSSProperties} /> : null}
        {card && kind === "wait" && walkout ? <div className="pack-door" style={{ "--pack-glow": glow } as CSSProperties} /> : null}
        {card && kind === "card" && walkout && !skipped && !step?.walkout ? <div className="pack-flash" /> : null}
        {card && kind === "card" && step?.walkout && !skipped ? <div className="pointer-events-none absolute inset-0 grid place-items-center"><WalkoutHandoff key={card.card_id} pull={card} glow={glow} /></div> : null}

        {index === -1 ? <div className="pack-tear grid h-72 w-56 place-items-center rounded-2xl border border-white/25 bg-[linear-gradient(145deg,#12261a,#061009)] text-center text-white shadow-2xl">
          <div><p className="text-xs font-bold tracking-[.3em] text-white/60">{tp.openingBanner}</p><p className="mt-2 px-3 text-xl font-black">{packName}</p>{jackpot ? <p className="mt-3 px-3 text-lg font-black" style={{ color: specialStyles.personal.badge }}>{tp.jackpot(jackpot)}</p> : null}</div>
        </div> : null}

        {card && kind === "walk" ? <WalkoutFigure pull={card} glow={glow} /> : null}

        {card && kind === "wait" ? <div className="relative grid h-[27rem] w-72 place-items-center rounded-2xl border border-white/25 bg-black/50 text-white shadow-2xl">
          <div className="text-center"><p className="text-5xl font-black">{card.position}</p><p className="mt-2 text-xs font-bold tracking-[.3em] text-white/60">{card.special ? `★ ${t.career.special.badge[card.special]}` : walkout ? "…" : tp.cardBanner}</p></div>
        </div> : null}

        {card && revealed ? <div className="relative grid gap-2">
          <div className={`relative ${kind === "turn" ? "pack-card-turn-out w-72" : step?.walkout && !skipped ? "pack-card-after-walkout w-72" : walkout && !skipped ? "pack-card-walkout w-72" : "pack-card-enter w-72"}`}>
            <PlayerCardFace player={card} eager />
            {step?.walkout && !skipped && kind === "card" ? <div aria-hidden className="pack-card-shine" /> : null}
          </div>
          <p className="pack-label-rise text-center text-sm text-white/75">
            {card.special === "inform" ? tp.informPulled : card.special ? `${t.career.special.badge[card.special]}!` : walkout ? tp.bigCard : ""} {card.location === "storage" ? tp.placedInStorage : tp.placedInSquad}{card.duplicate ? tp.alreadyOwned : ""}
          </p>
          <p className="text-center text-xs text-white/50">{tp.progress(shown, pulls.length)}</p>
        </div> : null}
      </div>
    </button>
    {step?.walkout && !lastStage ? <button type="button" onClick={skip} className="absolute right-3 top-3 z-10 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur hover:text-white">{tp.skipWalkout} »</button> : null}
    </>}
    {/* Skyggen som lukker seg over det siste kortet og åpner seg igjen over oppsummeringen. */}
    {closing ? <div aria-hidden className="pack-veil pack-veil-in" /> : null}
    {done ? <div aria-hidden className="pack-veil pack-veil-out" /> : null}
  </div>, document.body);
}

export function PackStore({ packs, freePacks, budget, shop }: { packs: ManagerPack[]; freePacks: Record<string, number>; budget: number; shop: PackShop }) {
  const tp = useT().market.packs;
  const nameOf = (pack: ManagerPack) => tp.name(pack.key, pack.name);
  const [state, action, pending] = useActionState(openManagerPackAction, initial);
  const [openOdds, setOpenOdds] = useState<string | null>(null);
  const [shownAt, setShownAt] = useState<number | null>(null);
  // Hvert trekk har sitt eget tidsstempel, så to like pakker etter hverandre
  // starter animasjonen på nytt i stedet for å bli stående.
  const showing = state.pulls?.length && state.openedAt && state.openedAt !== shownAt ? state.pulls : null;
  const openedPack = packs.find((pack) => pack.key === state.packKey);
  // Pakker som ikke kan kjøpes (f.eks. spesialpakken fra SBC) vises bare når man har en gratis å åpne.
  // Dagspakker vises hele eventet; serveren har allerede fjernet dem som er utenfor tidsvinduet.
  const visible = packs.filter((pack) => pack.purchasable || freePacks[pack.key] || pack.daily_limit !== null);

  return <section className={`${cardClass} grid gap-4`}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">{tp.eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold">{tp.title}</h2>
        <p className="mt-1 text-sm text-muted">{tp.intro}</p>
      </div>
      <b className="rounded-xl bg-accent-soft px-4 py-3 text-xl text-accent">{budget} MB</b>
    </div>

    {shop.pick ? <SpecialPick pick={shop.pick} kind="special" /> : null}
    {shop.playerPick ? <SpecialPick pick={shop.playerPick} kind="player" /> : null}

    {Object.values(freePacks).some(Boolean) ? <p className="rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm font-semibold text-accent">{tp.freePacks(packs.filter((pack) => freePacks[pack.key]).map((pack) => `${freePacks[pack.key]}× ${nameOf(pack)}`).join(", "))}</p> : null}


    <div className="flex flex-wrap gap-x-5 gap-y-1">
      <Link href="/managerkarriere/informs" className="text-xs font-black tracking-wide underline-offset-4 hover:underline" style={{ color: specialStyles.inform.border }}>{tp.allInforms} →</Link>
      <Link href="/managerkarriere/icons" className="text-xs font-black tracking-wide underline-offset-4 hover:underline" style={{ color: specialStyles.icon.glow }}>{tp.allIcons} →</Link>
      <Link href="/managerkarriere/honorable" className="text-xs font-black tracking-wide underline-offset-4 hover:underline" style={{ color: specialStyles.honorable.glow }}>{tp.allHonorable} →</Link>
      <Link href="/managerkarriere/innerpeace" className="text-xs font-black tracking-wide underline-offset-4 hover:underline" style={{ color: specialStyles.inner_peace.glow }}>{tp.allInnerPeace} →</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((pack) => {
        const affordable = budget >= pack.price;
        const free = freePacks[pack.key] ?? 0;
        const left = pack.weekly_limit === null ? null : Math.max(0, pack.weekly_limit - (shop.purchasedThisWeek[pack.key] ?? 0));
        const leftToday = pack.daily_purchase_limit === null ? null : Math.max(0, pack.daily_purchase_limit - (shop.purchasedToday[pack.key] ?? 0));
        const canBuy = pack.purchasable && affordable && left !== 0 && leftToday !== 0;
        const dailyLeft = pack.daily_limit === null ? null : Math.max(0, pack.daily_limit - (shop.openedToday[pack.key] ?? 0));
        const special = pack.special_guarantee > 0;
        const style = specialStyles[pack.special_scope === "tots" ? "tots" : "inform"];
        return <div key={pack.key} className="grid gap-3 rounded-xl border border-border bg-surface-raised p-4" style={special ? { borderColor: style.border, borderWidth: 2, background: style.background, color: "white" } : { borderTopColor: pack.accent, borderTopWidth: 3 }}>
          <div>
            <h3 className="text-lg font-bold">{special ? <span style={{ color: style.badge }}>★ </span> : null}{nameOf(pack)}</h3>
            <p className={`text-sm ${special ? "text-white/70" : "text-muted"}`}>{tp.description(pack.key, pack.description)}</p>
            <p className="mt-2 text-sm">{tp.cardCount(pack.card_count)} · {pack.guarantees.length || special ? tp.guarantee([...(special ? [tp.specialGuarantee(pack.special_guarantee, pack.special_scope === "mix" ? "all" : pack.special_scope)] : []), ...pack.guarantees.map((guarantee) => `${guarantee.count}× ${guarantee.min}+`)].join(", ")) : tp.noGuarantee}</p>
            {left !== null ? <p className={`mt-1 text-xs font-bold ${left ? "" : "text-danger"}`}>{tp.weeklyLeft(left, pack.weekly_limit ?? 0)}</p> : null}
            {dailyLeft !== null ? <p className="mt-1 text-xs font-bold">{tp.dailyLeft(dailyLeft, pack.daily_limit ?? 0)}</p> : null}
            {leftToday !== null ? <p className={`mt-1 text-xs font-bold ${leftToday ? "" : "text-danger"}`}>{tp.purchasesLeftToday(leftToday, pack.daily_purchase_limit ?? 0)}</p> : null}
          </div>
          {pack.purchasable || dailyLeft !== null || free > 0 ? <button type="button" className="justify-self-start text-xs underline" onClick={() => setOpenOdds((current) => current === pack.key ? null : pack.key)} aria-expanded={openOdds === pack.key}>
            {openOdds === pack.key ? tp.hideOdds : tp.showOdds}
          </button> : null}
          {openOdds === pack.key ? <div className="grid gap-2 rounded-lg border border-border p-3">
            <PackOdds pack={pack} informFactor={shop.informFactor} />
            <p className={`text-xs ${special ? "text-white/60" : "text-muted"}`}>{tp.oddsNote}</p>
          </div> : null}
          <div className="mt-auto grid gap-2">
            {dailyLeft !== null ? <form action={action} className="flex items-center justify-between gap-3">
              <input type="hidden" name="pack_key" value={pack.key} />
              <input type="hidden" name="daily" value="1" />
              <span className="rounded-full bg-black/10 px-3 py-1 text-sm font-bold">{tp.freeLabel}</span>
              <button className={dailyLeft ? buttonClass : secondaryButtonClass} disabled={!dailyLeft || pending}>{pending ? tp.openingShort : dailyLeft ? tp.openFree : tp.openedToday}</button>
            </form> : null}
            {free ? <form action={action} className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2">
              <input type="hidden" name="pack_key" value={pack.key} />
              <input type="hidden" name="free" value="1" />
              <span className="text-sm font-bold text-accent">{tp.freeCount(free)}</span>
              <button className={buttonClass} disabled={pending}>{pending ? tp.openingShort : tp.openFree}</button>
            </form> : null}
            {pack.purchasable ? <form action={action} className="flex items-center justify-between gap-3">
              <input type="hidden" name="pack_key" value={pack.key} />
              <span className="rounded-full bg-black/10 px-3 py-1 text-sm font-bold">{pack.price} MB</span>
              <button className={canBuy ? buttonClass : secondaryButtonClass} disabled={!canBuy || pending}>
                {pending ? tp.openingShort : left === 0 ? tp.boughtThisWeek : leftToday === 0 ? tp.boughtToday : affordable ? tp.openPack : tp.tooExpensive}
              </button>
            </form> : null}
          </div>
        </div>;
      })}
    </div>

    {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    {showing ? <PackReveal pulls={showing} packName={openedPack ? nameOf(openedPack) : tp.fallbackName} jackpot={state.jackpot ?? 0} onClose={() => setShownAt(state.openedAt ?? null)} /> : null}
  </section>;
}
