"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/client";
import type { ActionState } from "@/lib/actions";
import type { TeamView } from "@/lib/ai-opponent";
import type { DraftFixture, DraftPageData, DraftRoom, DraftView } from "@/lib/draft";
import { abandonDraftAction, chooseDraftFormationAction, createDraftRoomAction, inviteToDraftRoomAction, leaveDraftRoomAction, openDraftSlotAction, pickDraftPlayerAction, playDraftFixtureAction, respondDraftInviteAction, setDraftFormationAction, startDraftRoomAction, startSoloDraftAction, swapDraftPlayersAction } from "@/lib/draft-actions";
import { ALL_SLOT_KEYS, BENCH_KEYS, CAPTAIN_KEY, RESERVE_KEYS, ROOM_ROUNDS, ROOM_SIZE, slotLabel, SOLO_ROUNDS, STARTER_KEYS, type DraftPlayer, type DraftReward } from "@/lib/draft-core";
import { formationNames, formations, type Formation } from "@/lib/lineup";
import { ConfirmDialog } from "./confirm-dialog";
import { PlayerCardFace } from "./player-card-face";
import { PitchMarkings, slotPoint } from "./squad-pitch";
import { TeamCard, TeamDialog } from "./team-dialog";
import { useScrollLock } from "./use-scroll-lock";

const initial: ActionState = {};
const panelClass = "rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5";
const limeButton = "rounded-xl bg-lime-300 px-4 py-2.5 font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-50";
const ghostButton = "rounded-xl border border-white/15 px-4 py-2.5 text-sm font-black text-white/80 transition hover:border-white/40 hover:text-white disabled:opacity-50";

/** Hold siden oppdatert mens vi venter på andre (venner som drafter, kamper i bracketen). */
function useAutoRefresh(active: boolean, ms = 5_000) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, ms);
    return () => clearInterval(timer);
  }, [active, ms, router]);
}

function ErrorText({ error }: { error?: string | null }) {
  return error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null;
}

export function DraftPanel({ data, budget }: { data: DraftPageData; budget: number }) {
  const { current, last, room } = data;
  const inRoom = Boolean(room && (current?.mode === "room" || last?.mode === "room"));
  const roomLive = inRoom && room && (room.status === "open" || room.status === "playing");
  useAutoRefresh(Boolean(roomLive || data.friends.length || data.fixtures.some((fixture) => fixture.status === "live")));
  const canBringTeam = current?.mode === "solo" && current.wins === 0 && !data.fixtures.some((fixture) => fixture.status === "live" || fixture.status === "completed");

  if (current?.status === "drafting") {
    return <div className="grid gap-4">
      <DraftWallet tokens={data.tokens} />
      {inRoom && room?.status === "open" ? <RoomLobby room={room} data={data} /> : null}
      {current.mode === "solo" ? <DraftInvites data={data} budget={budget} canBringTeam={Boolean(canBringTeam)} /> : null}
      <DraftBuilder draft={current} />
      {canBringTeam ? <FriendsDraft data={data} budget={budget} bringTeam /> : null}
      {current.mode === "solo" ? <GiveUpDraft /> : null}
    </div>;
  }
  if (current?.status === "active") {
    return <div className="grid gap-4">
      <DraftWallet tokens={data.tokens} />
      {inRoom && room ? room.status === "open" ? <RoomLobby room={room} data={data} /> : <RoomBracket room={room} /> : <SoloRun draft={current} fixtures={data.fixtures} />}
      {current.mode === "solo" ? <DraftInvites data={data} budget={budget} canBringTeam={Boolean(canBringTeam)} /> : null}
      {canBringTeam ? <FriendsDraft data={data} budget={budget} bringTeam /> : null}
      <LineupEditor draft={current} locked={data.fixtures.some((fixture) => fixture.mine && fixture.status === "live")} />
    </div>;
  }
  return <div className="grid gap-4">
    <DraftWallet tokens={data.tokens} />
    <StartSoloDraft data={data} budget={budget} />
    {last ? <LastResult draft={last} packNames={data.packNames} losses={countLosses(last.mode === "room" ? room?.fixtures ?? [] : data.fixtures, last)} /> : null}
    {last?.mode === "room" && room && room.status !== "cancelled" && room.fixtures.length ? <RoomBracket room={room} /> : null}
    <DraftHome data={data} budget={budget} />
  </div>;
}

// ---------------------------------------------------------------------------
// Startsiden: solo, venneturnering, invitasjoner og historikk
// ---------------------------------------------------------------------------

function DraftWallet({ tokens }: { tokens: number }) {
  const t = useT().draft.tokens;
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3">
    <p className="font-black text-cyan-200">{t.balance(tokens)}</p>
    <p className="text-xs text-white/60">{t.hint}</p>
  </div>;
}

function RewardText({ reward, packNames }: { reward: DraftReward; packNames: Record<string, string> }) {
  const t = useT();
  const parts = [
    ...reward.packs.map((pack) => `${pack.quantity}× ${t.market.packs.name(pack.key, packNames[pack.key] ?? pack.key)}`),
    ...(reward.tokens ? [t.draft.tokens.reward(reward.tokens)] : []),
    ...(reward.mb ? [`${reward.mb} MB`] : []),
  ];
  return <>{parts.join(" + ") || "—"}</>;
}

function PrizeTable({ mode, data }: { mode: "solo" | "room"; data: DraftPageData }) {
  const t = useT().draft;
  const total = mode === "solo" ? SOLO_ROUNDS : ROOM_ROUNDS;
  return <div className="grid gap-2 rounded-xl bg-black/25 p-3 text-sm">
    <p className="text-[10px] font-black tracking-widest text-white/45">{t.home.prizes}</p>
    <p className="text-xs text-white/55">{t.home.randomPrizes}</p>
    {Array.from({ length: total + 1 }, (_, wins) => {
      const options = data.rewardOptions.filter((option) => option.mode === mode && option.wins === wins);
      const min = options.length ? Math.min(...options.map((option) => option.value)) : 0;
      return <details key={wins} className="rounded-lg border border-white/10 p-2" open={wins === total}>
        <summary className={`cursor-pointer font-black ${wins === total ? "text-lime-300" : "text-white/80"}`}>
          {t.home.prizeWins(wins, total)}{wins === total ? ` · ${t.home.minimumValue(min)}` : ""}
        </summary>
        <ul className="mt-2 grid gap-2 border-t border-white/10 pt-2 text-xs text-white/70">
          {options.map((option) => <li key={option.id}><RewardText reward={option} packNames={data.packNames} /></li>)}
        </ul>
      </details>;
    })}
  </div>;
}

function DraftInvites({ data, budget, canBringTeam = false }: { data: DraftPageData; budget: number; canBringTeam?: boolean }) {
  const t = useT().draft;
  const [respondState, respond, responding] = useActionState(respondDraftInviteAction, initial);
  const short = !canBringTeam && budget < data.entryFee;
  return (data.invites.length ? <section className={`${panelClass} border-cyan-300/40`}>
      <p className="text-[10px] font-black tracking-widest text-cyan-300">{t.home.invitesTitle}</p>
      <div className="mt-3 grid gap-2">
        {data.invites.map((invite) => <form key={invite.roomId} action={respond} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3">
          <input type="hidden" name="room_id" value={invite.roomId} />
          <p className="min-w-0 flex-1 text-sm"><b>{invite.hostName}</b> {t.home.invitedBy(invite.joined)}</p>
          <button name="answer" value="join" disabled={responding || short || Boolean(data.current && !canBringTeam)} className={limeButton}>{canBringTeam ? t.home.joinExisting : t.home.join(data.entryFee)}</button>
          {!canBringTeam && !data.current && data.tokens > 0 ? <button name="answer" value="join_token" disabled={responding} className={ghostButton}>{t.tokens.join}</button> : null}
          <button name="answer" value="decline" disabled={responding} className={ghostButton}>{t.home.decline}</button>
        </form>)}
      </div>
      {canBringTeam ? <p className="mt-2 text-xs text-white/55">{t.home.bringTeamHint}</p> : null}
      <ErrorText error={respondState.error} />
    </section> : null);
}

function FriendsDraft({ data, budget, bringTeam = false }: { data: DraftPageData; budget: number; bringTeam?: boolean }) {
  const t = useT().draft;
  const [roomState, createRoom, creatingRoom] = useActionState(createDraftRoomAction, initial);
  const short = !bringTeam && budget < data.entryFee;
  return (<section className={`${panelClass} grid content-start gap-3`}>
        <div><p className="text-[10px] font-black tracking-widest text-white/45">{t.home.roomEyebrow}</p><h3 className="text-xl font-black">{t.home.roomTitle}</h3><p className="mt-1 text-sm text-white/65">{t.home.roomText}</p></div>
        <PrizeTable mode="room" data={data} />
        <form action={createRoom} className="grid gap-2">
          {data.friends.length ? <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl bg-black/25 p-2">
            {data.friends.map((friend) => <label key={friend.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <input type="checkbox" name="friend_id" value={friend.id} className="h-4 w-4 accent-lime-300" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{friend.username}</span>
              {friend.drafting ? <span className="rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-black tracking-wide text-lime-300">● {t.home.draftingNow}</span> : null}
            </label>)}
          </div> : <p className="text-sm text-white/55">{t.home.noFriends}</p>}
          <button disabled={creatingRoom || short || !data.friends.length} className={limeButton}>{creatingRoom ? t.home.creating : bringTeam ? t.home.createWithTeam : t.home.createRoom(data.entryFee)}</button>
          {!bringTeam && data.tokens > 0 ? <button name="payment" value="token" disabled={creatingRoom || !data.friends.length} className={ghostButton}>{t.tokens.create}</button> : null}
          <p className="text-xs text-white/45">{bringTeam ? t.home.bringTeamHint : t.home.roomHint(ROOM_SIZE)}</p>
          <ErrorText error={roomState.error} />
        </form>
      </section>);
}

/** Kjøpsknappen for en ny solo-draft. Ligger øverst på startsiden, over forrige resultat. */
function StartSoloDraft({ data, budget }: { data: DraftPageData; budget: number }) {
  const t = useT().draft;
  const [soloState, startSolo, startingSolo] = useActionState(startSoloDraftAction, initial);
  const short = budget < data.entryFee;
  return <form action={startSolo} className="grid gap-2">
    <button disabled={startingSolo || short} className={`${limeButton} py-3 text-lg`}>{startingSolo ? t.home.starting : t.home.startSolo(data.entryFee)}</button>
    {data.tokens > 0 ? <button name="payment" value="token" disabled={startingSolo} className={ghostButton}>{t.tokens.start}</button> : null}
    {short && data.tokens === 0 ? <p className="text-xs text-rose-300">{t.home.notEnough(data.entryFee)}</p> : null}
    <ErrorText error={soloState.error} />
  </form>;
}

function DraftHome({ data, budget }: { data: DraftPageData; budget: number }) {
  const t = useT().draft;
  return <div className="grid gap-4">
    <section className="relative overflow-hidden rounded-2xl border border-lime-300/30 bg-[#08101b] p-5 sm:p-6" style={{ backgroundImage: "radial-gradient(circle at 85% 0%, rgba(152,255,44,.18), transparent 35%), radial-gradient(circle at 0% 100%, rgba(24,207,255,.14), transparent 35%)" }}>
      <p className="text-[10px] font-black tracking-[.28em] text-lime-300">{t.home.eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black sm:text-3xl">{t.home.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/70">{t.home.intro}</p>
    </section>

    <DraftInvites data={data} budget={budget} />

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${panelClass} grid content-start gap-3`}>
        <div><p className="text-[10px] font-black tracking-widest text-white/45">{t.home.soloEyebrow}</p><h3 className="text-xl font-black">{t.home.soloTitle}</h3><p className="mt-1 text-sm text-white/65">{t.home.soloText}</p></div>
        <PrizeTable mode="solo" data={data} />
      </section>

      <FriendsDraft data={data} budget={budget} />
    </div>

    {data.history.length ? <section className={panelClass}>
      <p className="text-[10px] font-black tracking-widest text-white/45">{t.home.history}</p>
      <div className="mt-2 grid gap-1">
        {data.history.map((entry) => <div key={entry.id} className="grid grid-cols-2 gap-2 border-b border-white/5 py-2 text-sm last:border-0">
          <span className="font-bold">{entry.mode === "solo" ? t.home.soloTitle : t.home.roomTitle}</span>
          <span className={entry.status === "champion" ? "font-black text-lime-300" : "text-white/70"}>{t.result.wins(entry.wins, entry.mode === "solo" ? SOLO_ROUNDS : ROOM_ROUNDS)}</span>
          <span className="col-span-2 text-right text-white/60"><RewardText reward={entry.reward} packNames={data.packNames} /></span>
        </div>)}
      </div>
    </section> : null}
  </div>;
}

/** Antall kamper dette laget har tapt, ut fra kampene som er spilt. */
function countLosses(fixtures: DraftFixture[], draft: DraftView) {
  if (draft.status === "champion") return 0;
  return fixtures.filter((fixture) => fixture.mine && fixture.status === "completed" && (fixture.winner === "home" ? fixture.away?.mine : fixture.home?.mine)).length;
}

function LastResult({ draft, packNames, losses }: { draft: DraftView; packNames: Record<string, string>; losses: number }) {
  const t = useT().draft;
  const total = draft.mode === "solo" ? SOLO_ROUNDS : ROOM_ROUNDS;
  const champion = draft.status === "champion";
  const running = draft.status === "drafting" || draft.status === "active";
  if (running || draft.status === "cancelled") return null;
  return <section className={`relative overflow-hidden rounded-2xl border p-5 ${champion ? "border-lime-300/60 bg-lime-300/10" : "border-white/10 bg-slate-900/75"}`}>
    <p className="text-[10px] font-black tracking-[.28em] text-white/50">{t.result.eyebrow}</p>
    <h2 className="mt-1 text-2xl font-black">{champion ? t.result.champion : t.result.eliminated(roundName(t, draft.wins + 1, total))}</h2>
    <p className="mt-1 text-white/70">{t.result.record}: <b className="font-black text-white">{draft.wins}–{losses}</b></p>
    <p className="mt-3 block w-fit max-w-full rounded-xl bg-black/30 px-3 py-2 text-sm font-black text-lime-300">{t.result.prize}: <RewardText reward={draft.reward} packNames={packNames} /></p>
    {draft.reward.packs.length ? <p className="mt-2 text-xs text-white/50">{t.result.packHint}</p> : null}
  </section>;
}

type DraftT = ReturnType<typeof useT>["draft"];
function roundName(t: DraftT, round: number, total: number) {
  const left = total - round;
  return left === 0 ? t.rounds.final : left === 1 ? t.rounds.semi : left === 2 ? t.rounds.quarter : t.rounds.round(round);
}

// ---------------------------------------------------------------------------
// Draftingen
// ---------------------------------------------------------------------------

function FormationPreview({ formation }: { formation: Formation }) {
  return <div className="relative mx-auto aspect-[3/4] w-24 rounded-lg border border-emerald-200/25 bg-[#0d5a3c]">
    {formations[formation].map((slot, index) => <span key={index} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-200" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} />)}
  </div>;
}

function DraftBuilder({ draft }: { draft: DraftView }) {
  const t = useT().draft;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const picks = Object.keys(draft.players).length;

  if (!draft.formation) {
    return <section className={panelClass}>
      <p className="text-[10px] font-black tracking-widest text-lime-300">{t.build.step(1)}</p>
      <h2 className="text-xl font-black">{t.build.formationTitle}</h2>
      <p className="mt-1 text-sm text-white/60">{t.build.formationHint}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {formationNames.map((formation) => <button key={formation} type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await chooseDraftFormationAction(formation); setError(result.error ?? null); router.refresh(); })} className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-lime-300/60 disabled:opacity-50">
          <FormationPreview formation={formation} />
          <b className="text-center">{formation}</b>
        </button>)}
      </div>
      <ErrorText error={error} />
    </section>;
  }

  const needsCaptain = !draft.captainId;
  return <div className="grid gap-4">
    <section className={`${panelClass} flex flex-wrap items-center gap-x-6 gap-y-2`}>
      <div className="min-w-0 basis-full sm:flex-1">
        <p className="text-[10px] font-black tracking-widest text-lime-300">{needsCaptain ? t.build.step(2) : t.build.step(3)}</p>
        <h2 className="text-xl font-black">{needsCaptain ? t.build.captainTitle : t.build.pickTitle}</h2>
        <p className="text-sm text-white/60">{needsCaptain ? t.build.captainHint : t.build.pickHint}</p>
      </div>
      <div className="flex gap-5">
        <div><p className="text-[10px] font-bold tracking-widest text-white/45">{t.build.picks}</p><p className="text-lg font-black">{picks}/{ALL_SLOT_KEYS.length}</p></div>
        <div className="border-l border-white/15 pl-5"><p className="text-[10px] font-bold tracking-widest text-white/45">{t.build.rating}</p><p className="text-lg font-black text-lime-300">{draft.rating ?? "—"}</p></div>
        <div className="border-l border-white/15 pl-5"><p className="text-[10px] font-bold tracking-widest text-white/45">{t.build.formation}</p><p className="text-lg font-black">{draft.formation}</p></div>
      </div>
      {needsCaptain ? <button type="button" onClick={() => setOpenKey(CAPTAIN_KEY)} className={`${limeButton} w-full sm:w-auto`}>{t.build.chooseCaptain}</button> : null}
    </section>
    <DraftPitch formation={draft.formation} players={draft.players} captainId={draft.captainId} onSlot={needsCaptain ? () => setOpenKey(CAPTAIN_KEY) : (key) => { if (!draft.players[key]) setOpenKey(key); }} highlightEmpty={!needsCaptain} />
    <ErrorText error={error} />
    {openKey ? <OptionsDialog slotKey={openKey} formation={draft.formation} drawn={draft.offers[openKey]} onClose={() => setOpenKey(null)} onPicked={() => { setOpenKey(null); router.refresh(); }} /> : null}
  </div>;
}

/** Vinduet med de fem alternativene til en plass. Alternativene hentes (og trekkes første gang) når vinduet åpnes. */
function OptionsDialog({ slotKey, formation, drawn, onClose, onPicked }: { slotKey: string; formation: Formation; drawn?: DraftPlayer[]; onClose: () => void; onPicked: () => void }) {
  const t = useT().draft;
  // Alternativer som allerede er trukket, vises med en gang. Ellers trekkes de på serveren.
  const [options, setOptions] = useState<DraftPlayer[] | null>(drawn?.length ? drawn : null);
  const alreadyDrawn = Boolean(drawn?.length);
  const displayedOptions = alreadyDrawn ? drawn : options;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Siden oppdateres jevnlig i en venneturnering. Alternativene skal ikke hentes på nytt av den grunn.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const failed = t.errors.busy;
  useScrollLock();
  useEffect(() => {
    let current = true;
    if (!alreadyDrawn) openDraftSlotAction(slotKey).then((result) => { if (!current) return; if ("error" in result) setError(result.error); else setOptions(result.options); }).catch(() => { if (current) setError(failed); });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { current = false; window.removeEventListener("keydown", onKey); };
  }, [slotKey, failed, alreadyDrawn]);
  const label = slotKey === CAPTAIN_KEY ? t.build.captainTitle : slotKey.startsWith("r") ? t.build.reserve : `${slotKey.startsWith("b") ? `${t.build.bench} · ` : ""}${slotLabel(slotKey, formation) ?? t.build.anyPosition}`;
  return createPortal(<div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 text-white" onClick={onClose}>
    <div role="dialog" aria-modal="true" className="grid w-full max-w-6xl gap-4 rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-5" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-black tracking-widest text-lime-300">{t.build.pickFor}</p><h3 className="text-xl font-black">{label}</h3></div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-black hover:bg-white/20">{t.build.close}</button>
      </div>
      {!displayedOptions && !error ? <p className="py-16 text-center text-sm text-white/60">{t.build.loading}</p> : null}
      <ErrorText error={error} />
      {displayedOptions ? <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
        {displayedOptions.map((option) => <div key={option.id} className="w-56 shrink-0 snap-center sm:w-auto">
          <PlayerCardFace player={{ slug: option.slug ?? "", name: option.name, position: option.position, overall: option.overall, accent: option.accent ?? "#35d06a", club: option.club ?? "", attributes: option.attributes, special: option.special }} footer={<button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await pickDraftPlayerAction(slotKey, option.id); if (result.error) setError(result.error); else onPicked(); })} className={`${limeButton} w-full`}>{t.build.choose}</button>} />
        </div>)}
      </div> : null}
    </div>
  </div>, document.body);
}

/** Banen med elleveren, og benken og reservene under. Brukes både mens man drafter og når laget skal endres. */
function DraftPitch({ formation, players, captainId, onSlot, selected = null, highlightEmpty = false }: { formation: Formation; players: Record<string, DraftPlayer>; captainId: string | null; onSlot: (key: string) => void; selected?: string | null; highlightEmpty?: boolean }) {
  const t = useT().draft;
  const slots = formations[formation];
  const cell = (key: string) => {
    const player = players[key];
    const ring = selected === key ? "ring-4 ring-lime-300" : "";
    return <button key={key} type="button" onClick={() => onSlot(key)} className={`relative block w-full rounded-[9%/7%] transition hover:scale-105 ${ring}`} aria-label={player ? player.name : slotLabel(key, formation) ?? t.build.anyPosition}>
      {player ? <TeamCard player={player} /> : <span className={`grid aspect-[100/136] w-full place-items-center rounded-[9%/7%] border-2 border-dashed text-center ${highlightEmpty ? "border-lime-300/70 bg-lime-300/10 text-lime-200" : "border-white/25 bg-black/20 text-white/50"}`}>
        <span className="grid gap-0.5"><b className="text-lg leading-none">+</b><span className="text-[10px] font-black">{slotLabel(key, formation) ?? (key.startsWith("r") ? t.build.reserveShort : t.build.anyShort)}</span></span>
      </span>}
      {player && player.id === captainId ? <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[10px] font-black text-slate-950">C</span> : null}
    </button>;
  };
  return <div className="mx-auto grid w-full max-w-3xl gap-3">
    <div className="@container relative aspect-[1000/900] overflow-hidden rounded-2xl border border-emerald-200/25 bg-[#062a1d] shadow-[inset_0_0_90px_rgba(0,0,0,.6)]">
      <PitchMarkings layout="wide" />
      {STARTER_KEYS.map((key, index) => { const point = slotPoint(slots[index], "wide"); return <div key={key} className="absolute w-[clamp(44px,12.5cqw,110px)] -translate-x-1/2 -translate-y-1/2" style={{ left: point.left, top: point.top }}>{cell(key)}</div>; })}
    </div>
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/75 p-3">
      <p className="text-[10px] font-black tracking-widest text-white/45">{t.build.bench}</p>
      <div className="mx-auto grid w-full max-w-xl grid-cols-4 gap-2 sm:grid-cols-7">{BENCH_KEYS.map(cell)}</div>
      <p className="mt-2 text-[10px] font-black tracking-widest text-white/45">{t.build.reserves}</p>
      <div className="mx-auto grid w-full max-w-xl grid-cols-5 gap-2 sm:grid-cols-7">{RESERVE_KEYS.map(cell)}</div>
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// Turneringen
// ---------------------------------------------------------------------------

function LineupEditor({ draft, locked }: { draft: DraftView; locked: boolean }) {
  const t = useT().draft;
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!draft.formation) return null;
  const onSlot = (key: string) => {
    if (locked || pending) return;
    if (!selected) { setSelected(key); return; }
    if (selected === key) { setSelected(null); return; }
    const first = selected; setSelected(null);
    startTransition(async () => { const result = await swapDraftPlayersAction(first, key); setError(result.error ?? null); router.refresh(); });
  };
  return <section className="grid gap-3">
    <div className={`${panelClass} flex flex-wrap items-center gap-3`}>
      <div className="min-w-0 flex-1"><h3 className="text-lg font-black">{t.lineup.title}</h3><p className="text-sm text-white/60">{locked ? t.lineup.locked : selected ? t.lineup.pickSecond : t.lineup.hint}</p></div>
      <p className="text-sm font-black text-lime-300">{t.build.rating} {draft.rating ?? "—"}</p>
      <select value={draft.formation} disabled={locked || pending} onChange={(event) => { const formation = event.target.value; startTransition(async () => { const result = await setDraftFormationAction(formation); setError(result.error ?? null); router.refresh(); }); }} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm font-black">
        {formationNames.map((formation) => <option key={formation} value={formation}>{formation}</option>)}
      </select>
    </div>
    <ErrorText error={error} />
    <DraftPitch formation={draft.formation} players={draft.players} captainId={draft.captainId} onSlot={onSlot} selected={selected} />
  </section>;
}

function PlayButton({ fixture }: { fixture: DraftFixture }) {
  const t = useT().draft;
  const [state, action, pending] = useActionState(playDraftFixtureAction, initial);
  return <form action={action} className="grid gap-1">
    <input type="hidden" name="fixture_id" value={fixture.id} />
    <button disabled={pending} className={`${limeButton} py-3`}>{pending ? t.run.starting : fixture.status === "live" ? t.run.continueLive : t.run.play}</button>
    <ErrorText error={state.error} />
  </form>;
}

function score(fixture: DraftFixture) {
  if (fixture.homeScore === null || fixture.awayScore === null) return null;
  const pens = fixture.homePenalties !== null && fixture.awayPenalties !== null ? ` (${fixture.homePenalties}–${fixture.awayPenalties})` : "";
  return `${fixture.homeScore}–${fixture.awayScore}${pens}`;
}

function GiveUpDraft() {
  const t = useT().draft;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const giveUp = () => {
    setConfirming(false);
    startTransition(async () => {
      const result = await abandonDraftAction(initial, new FormData());
      setError(result.error ?? null);
      router.refresh();
    });
  };
  return <div className="grid gap-2">
    <div className="flex justify-end"><button type="button" disabled={pending} onClick={() => setConfirming(true)} className="text-xs font-bold text-white/45 underline-offset-4 hover:text-rose-300 hover:underline">{t.run.giveUp}</button></div>
    <ErrorText error={error} />
    {confirming ? <ConfirmDialog message={t.run.giveUpConfirm} onCancel={() => setConfirming(false)} onConfirm={giveUp} /> : null}
  </div>;
}

function SoloRun({ draft, fixtures }: { draft: DraftView; fixtures: DraftFixture[] }) {
  const t = useT().draft;
  const [viewing, setViewing] = useState<TeamView | null>(null);
  const next = fixtures.find((fixture) => fixture.status === "scheduled" || fixture.status === "live");
  return <div className="grid gap-4">
    {next ? <section className="relative overflow-hidden rounded-2xl border border-lime-300/40 bg-[#08101b] p-5" style={{ backgroundImage: "radial-gradient(circle at 90% 0%, rgba(152,255,44,.16), transparent 35%)" }}>
      <p className="text-[10px] font-black tracking-[.28em] text-lime-300">{roundName(t, next.round, SOLO_ROUNDS)} · {t.run.matchOf(next.round, SOLO_ROUNDS)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/55">{t.run.opponent}</p>
          <h2 className="truncate text-2xl font-black">{next.away?.name ?? "—"}</h2>
          <p className="text-sm text-white/65">{t.run.ratingVs(draft.rating ?? 0, next.away?.rating ?? 0)}</p>
        </div>
        <div className="grid w-full gap-2 sm:w-64">
          <PlayButton fixture={next} />
          {next.away?.team ? <button type="button" onClick={() => setViewing(next.away!.team)} className={ghostButton}>{t.run.viewTeam}</button> : null}
        </div>
      </div>
    </section> : null}
    <SoloLadder fixtures={fixtures} wins={draft.wins} active />
    {next?.status !== "live" ? <GiveUpDraft /> : null}
    {viewing ? <TeamDialog source={{ team: viewing }} onClose={() => setViewing(null)} /> : null}
  </div>;
}

/** De fem rundene i solo, med resultatene så langt og hvor langt du er kommet. */
function SoloLadder({ fixtures, wins, active }: { fixtures: DraftFixture[]; wins: number; active: boolean }) {
  const t = useT().draft;
  return <section className={panelClass}>
    <p className="text-[10px] font-black tracking-widest text-white/45">{t.run.ladder}</p>
    <ol className="mt-3 grid gap-2">
      {Array.from({ length: SOLO_ROUNDS }, (_, index) => index + 1).map((round) => {
        const fixture = fixtures.find((entry) => entry.round === round);
        const won = fixture?.status === "completed" && fixture.winner === "home";
        const lost = fixture?.status === "completed" && fixture.winner === "away";
        const current = active && round === wins + 1;
        return <li key={round} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${current ? "border-lime-300/60 bg-lime-300/10" : won ? "border-lime-300/20 bg-white/5" : lost ? "border-rose-400/40 bg-rose-500/10" : "border-white/5 bg-black/20 text-white/45"}`}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${won ? "bg-lime-300 text-slate-950" : lost ? "bg-rose-400 text-slate-950" : "bg-white/10"}`}>{won ? "✓" : lost ? "✕" : round}</span>
          <span className="w-24 shrink-0 text-xs font-black tracking-wide sm:w-32">{roundName(t, round, SOLO_ROUNDS)}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{fixture?.away ? `${fixture.away.name} · ${fixture.away.rating}` : t.run.tbd}</span>
          <span className="shrink-0 text-sm font-black">{fixture ? score(fixture) ?? (fixture.status === "live" ? t.run.live : "") : ""}</span>
        </li>;
      })}
    </ol>
  </section>;
}

// ---------------------------------------------------------------------------
// Venneturneringen
// ---------------------------------------------------------------------------

function RoomLobby({ room, data }: { room: DraftRoom; data: DraftPageData }) {
  const t = useT().draft;
  const isHost = room.hostId === data.userId;
  const [inviteState, invite, inviting] = useActionState(inviteToDraftRoomAction, initial);
  const [startState, start, starting] = useActionState(startDraftRoomAction, initial);
  const [leaveState, leave, leaving] = useActionState(leaveDraftRoomAction, initial);
  const joined = room.members.filter((member) => member.status === "joined");
  const everyoneReady = joined.length >= 2 && joined.every((member) => member.draftStatus === "active");
  const invitable = data.friends.filter((friend) => !room.members.some((member) => member.userId === friend.id));
  return <section className={`${panelClass} grid gap-3 border-cyan-300/30`}>
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black tracking-widest text-cyan-300">{t.room.eyebrow}</p>
        <h2 className="text-xl font-black">{t.room.title(room.hostName)}</h2>
        <p className="text-sm text-white/60">{t.room.lobbyHint(ROOM_SIZE)}</p>
      </div>
      <form action={leave}><input type="hidden" name="room_id" value={room.id} /><button disabled={leaving} className={ghostButton}>{isHost ? t.room.cancel : t.room.leave}</button></form>
    </div>
    <ul className="grid gap-1.5">
      {room.members.map((member) => <li key={member.userId} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-bold">{member.username}{member.userId === room.hostId ? <span className="ml-2 text-[10px] font-black text-cyan-300">{t.room.hostTag}</span> : null}</span>
        <span className={`text-xs font-black ${member.status === "invited" ? "text-white/45" : member.draftStatus === "active" ? "text-lime-300" : "text-amber-200"}`}>
          {member.status === "invited" ? t.room.invited : member.draftStatus === "active" ? t.room.ready(member.rating ?? 0) : t.room.drafting(member.picks, ALL_SLOT_KEYS.length)}
        </span>
      </li>)}
    </ul>
    {isHost ? <div className="grid gap-2 sm:grid-cols-2">
      {invitable.length && joined.length < ROOM_SIZE ? <form action={invite} className="flex gap-2">
        <input type="hidden" name="room_id" value={room.id} />
        <select name="friend_id" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm">{invitable.map((friend) => <option key={friend.id} value={friend.id}>{friend.username}{friend.drafting ? ` · ${t.home.draftingNow}` : ""}</option>)}</select>
        <button disabled={inviting} className={ghostButton}>{t.room.invite}</button>
      </form> : <span />}
      <form action={start} className="grid">
        <input type="hidden" name="room_id" value={room.id} />
        <button disabled={starting || !everyoneReady} className={limeButton}>{starting ? t.home.starting : t.room.start}</button>
      </form>
    </div> : <p className="text-sm text-white/55">{t.room.waitingForHost}</p>}
    {isHost && !everyoneReady ? <p className="text-xs text-white/45">{t.room.startHint}</p> : null}
    <ErrorText error={inviteState.error ?? startState.error ?? leaveState.error} />
  </section>;
}

function BracketSide({ side, winner, onView }: { side: DraftFixture["home"]; winner: boolean; onView: (team: TeamView) => void }) {
  const t = useT().draft;
  if (!side) return <div className="px-3 py-2 text-sm text-white/35">{t.run.tbd}</div>;
  return <button type="button" disabled={!side.team} onClick={() => side.team && onView(side.team)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/5 ${side.mine ? "text-lime-300" : ""} ${winner ? "font-black" : "text-white/75"}`}>
    <span className="min-w-0 flex-1 truncate">{side.name}{side.userId ? "" : ` · ${t.room.aiTag}`}</span>
    <span className="text-xs text-white/50">{side.rating ?? ""}</span>
  </button>;
}

function RoomBracket({ room }: { room: DraftRoom }) {
  const t = useT().draft;
  const [viewing, setViewing] = useState<TeamView | null>(null);
  const mine = room.fixtures.find((fixture) => fixture.mine && (fixture.status === "scheduled" || fixture.status === "live"));
  return <div className="grid gap-4">
    {mine ? <section className="rounded-2xl border border-lime-300/40 bg-[#08101b] p-5">
      <p className="text-[10px] font-black tracking-[.28em] text-lime-300">{roundName(t, mine.round, ROOM_ROUNDS)}</p>
      <h2 className="mt-1 text-2xl font-black">{mine.home?.name} – {mine.away?.name}</h2>
      <div className="mt-3 sm:w-64"><PlayButton fixture={mine} /></div>
      {mine.home?.userId && mine.away?.userId ? <p className="mt-2 text-xs text-white/50">{t.room.friendMatchHint}</p> : null}
    </section> : null}
    <section className={panelClass}>
      <p className="text-[10px] font-black tracking-widest text-white/45">{t.room.bracket}{room.status === "completed" ? ` · ${t.room.finished}` : ""}</p>
      <div className="mt-3 grid gap-4 overflow-x-auto md:grid-cols-3">
        {Array.from({ length: ROOM_ROUNDS }, (_, index) => index + 1).map((round) => <div key={round} className="grid content-around gap-3">
          <p className="text-xs font-black tracking-wide text-white/55">{roundName(t, round, ROOM_ROUNDS)}</p>
          {Array.from({ length: ROOM_SIZE / 2 ** round }, (_, slot) => {
            const fixture = room.fixtures.find((entry) => entry.round === round && entry.slot === slot);
            return <div key={slot} className={`overflow-hidden rounded-xl border ${fixture?.mine ? "border-lime-300/40" : "border-white/10"} bg-black/25`}>
              <BracketSide side={fixture?.home ?? null} winner={fixture?.winner === "home"} onView={setViewing} />
              <div className="flex items-center justify-between border-t border-white/5 px-3 text-[10px] font-black text-white/40"><span>{fixture ? score(fixture) ?? (fixture.status === "live" ? t.run.live : "") : ""}</span></div>
              <BracketSide side={fixture?.away ?? null} winner={fixture?.winner === "away"} onView={setViewing} />
            </div>;
          })}
        </div>)}
      </div>
    </section>
    {viewing ? <TeamDialog source={{ team: viewing }} onClose={() => setViewing(null)} /> : null}
  </div>;
}
