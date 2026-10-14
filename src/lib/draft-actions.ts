"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, getT } from "@/i18n/server";
import type { ActionState } from "./actions";
import { requireUser } from "./auth";
import { aiDraftTeam, draftColumns, draftPool, drawOptions, isTaken, takenKeys, type DraftAiSide, type DraftRow, type FixtureRow } from "./draft";
import { AI_CHEMISTRY_RATING } from "./chemistry";
import { ALL_SLOT_KEYS, CAPTAIN_KEY, captainSlot, draftComplete, draftFormation, draftRating, draftTeamSnapshot, DRAFT_RATING_WEIGHT, OPTIONS_PER_PICK, ROOM_SIZE, type DraftPlayer } from "./draft-core";
import { friendshipId } from "./friends";
import { formationNames, type Formation } from "./lineup";
import { MANAGER_KICKOFF_VERSION, planManagerTimeline, type ManagerTeamSnapshot } from "./manager-match";
import { managerMatchLimitError } from "./match-limit";
import { supabaseAdmin } from "./supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

function draftPaths() { revalidatePath("/managerkarriere"); revalidatePath("/managerkarriere/draft"); }

/** Den pågående draften din (under drafting eller i turneringen). */
async function runningDraft(db: Db, userId: string): Promise<DraftRow | null> {
  const { data } = await db.from("career_drafts").select(draftColumns).eq("user_id", userId).in("status", ["drafting", "active"]).maybeSingle();
  return (data as unknown as DraftRow | null) ?? null;
}

/**
 * Skriver endringer i draften bare hvis ingen andre har endret den siden vi leste den, så to trykk samtidig
 * ikke kan trekke nye alternativer eller velge to spillere til samme plass.
 */
async function saveDraft(db: Db, draft: DraftRow, changes: Partial<Pick<DraftRow, "formation" | "offers" | "players" | "captain_id" | "status">>): Promise<string | null> {
  const { data, error } = await db.from("career_drafts").update(changes).eq("id", draft.id).eq("updated_at", draft.updated_at).select("id");
  if (error) return dbErrorMessage(error);
  return data?.length ? null : (await getT()).draft.errors.busy;
}

/** AI-lagene i draft har ikke ekte kjemi, men samme faste kjemi som oppdiktede AI-klubber i sesongen. */
function aiDraftSide(side: DraftAiSide | null): ManagerTeamSnapshot | null {
  return side?.team ? { ...side.team, chemistryBonus: side.team.chemistryBonus ?? AI_CHEMISTRY_RATING } : null;
}

export async function startSoloDraftAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  void _prev;
  const user = await requireUser();
  const { error } = await supabaseAdmin().rpc("start_draft_with_payment", { target_user: user.id, target_room: null, use_token: _formData.get("payment") === "token" });
  if (error) return { error: await dbErrorMessage(error) };
  draftPaths(); return { ok: true };
}

export async function chooseDraftFormationAction(formation: string): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const draft = await runningDraft(db, user.id);
  if (!draft || draft.status !== "drafting" || draft.formation) return { error: errors.notDrafting };
  if (!formationNames.includes(formation as Formation)) return { error: errors.invalidFormation };
  const error = await saveDraft(db, draft, { formation });
  if (error) return { error };
  draftPaths(); return { ok: true };
}

/**
 * Viser alternativene til en plass. Første gang trekkes fem spillere og lagres, så det hjelper ikke å lukke
 * og åpne plassen igjen. Kapteinen må velges før alle andre.
 */
export async function openDraftSlotAction(key: string): Promise<{ options: DraftPlayer[] } | { error: string }> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const draft = await runningDraft(db, user.id);
    const formation = draftFormation(draft?.formation);
    if (!draft || draft.status !== "drafting" || !formation) return { error: errors.notDrafting };
    const players = draft.players ?? {}; const offers = draft.offers ?? {};
    if (key !== CAPTAIN_KEY && !ALL_SLOT_KEYS.includes(key)) return { error: errors.invalidSlot };
    if (key === CAPTAIN_KEY ? draft.captain_id : players[key]) return { error: errors.slotFilled };
    if (key !== CAPTAIN_KEY && !draft.captain_id) return { error: errors.captainFirst };
    const taken = takenKeys(Object.values(players));
    const cached = offers[key] ?? [];
    // Et lagret tilbud kan inneholde en spiller som siden er kommet i laget. Da byttes bare de kortene ut.
    if (cached.length && !cached.some((entry) => isTaken(taken, entry))) return { options: cached };
    const kept = cached.filter((entry) => !isTaken(taken, entry));
    const excluded = new Set([...taken, ...takenKeys(kept)]);
    const options = [...kept, ...drawOptions(await draftPool(db), key, formation, excluded).slice(0, OPTIONS_PER_PICK - kept.length)];
    if (!options.length) return { error: errors.noOptions };
    const error = await saveDraft(db, draft, { offers: { ...offers, [key]: options } });
    if (!error) return { options };
  }
  return { error: errors.busy };
}

export async function pickDraftPlayerAction(key: string, optionId: string): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  if (key !== CAPTAIN_KEY && !ALL_SLOT_KEYS.includes(key)) return { error: errors.invalidSlot };
  const draft = await runningDraft(db, user.id);
  const formation = draftFormation(draft?.formation);
  if (!draft || draft.status !== "drafting" || !formation) return { error: errors.notDrafting };
  const players = { ...(draft.players ?? {}) };
  const option = (draft.offers ?? {})[key]?.find((entry) => entry.id === optionId);
  if (!option) return { error: errors.invalidSlot };
  if (isTaken(takenKeys(Object.values(players)), option)) return { error: errors.alreadyPicked };
  let target = key; let captain = draft.captain_id;
  if (key === CAPTAIN_KEY) {
    if (draft.captain_id) return { error: errors.slotFilled };
    const slot = captainSlot(formation, players, option.position);
    if (!slot) return { error: errors.invalidSlot };
    target = slot; captain = option.id;
  } else if (players[key]) return { error: errors.slotFilled };
  else if (!draft.captain_id) return { error: errors.captainFirst };
  players[target] = option;
  // Et tilbud på en annen plass kan inneholde spilleren som nettopp ble valgt.
  // Behold de øvrige alternativene og erstatt bare kort som nå er i laget.
  const offers = { ...(draft.offers ?? {}) };
  const taken = takenKeys(Object.values(players));
  const staleKeys = Object.keys(offers).filter((offerKey) => offerKey !== CAPTAIN_KEY && !players[offerKey] && offers[offerKey].some((entry) => isTaken(taken, entry)));
  if (staleKeys.length) {
    const pool = await draftPool(db);
    for (const offerKey of staleKeys) {
      const kept = offers[offerKey].filter((entry) => !isTaken(taken, entry));
      const excluded = new Set([...taken, ...takenKeys(kept)]);
      offers[offerKey] = [...kept, ...drawOptions(pool, offerKey, formation, excluded).slice(0, offers[offerKey].length - kept.length)];
    }
  }
  const error = await saveDraft(db, draft, { players, offers, captain_id: captain, ...(draftComplete(players) ? { status: "active" as const } : {}) });
  if (error) return { error };
  draftPaths(); return { ok: true };
}

/** Kampene draften er med i som ikke er ferdige. Laget kan ikke endres mens en av dem pågår. */
async function hasLiveFixture(db: Db, draftId: string) {
  const { data } = await db.from("career_draft_fixtures").select("id").or(`home_draft_id.eq.${draftId},away_draft_id.eq.${draftId}`).eq("status", "live").limit(1);
  return Boolean(data?.length);
}

/** Bytter plass på to spillere i laget (elleveren, benken eller reservene) mellom kampene. */
export async function swapDraftPlayersAction(first: string, second: string): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const draft = await runningDraft(db, user.id);
  if (!draft || draft.status !== "active") return { error: errors.notActive };
  if (first === second || !ALL_SLOT_KEYS.includes(first) || !ALL_SLOT_KEYS.includes(second)) return { error: errors.invalidSlot };
  if (await hasLiveFixture(db, draft.id)) return { error: errors.matchLive };
  const players = { ...(draft.players ?? {}) };
  [players[first], players[second]] = [players[second], players[first]];
  const error = await saveDraft(db, draft, { players });
  if (error) return { error };
  draftPaths(); return { ok: true };
}

export async function setDraftFormationAction(formation: string): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const draft = await runningDraft(db, user.id);
  if (!draft || draft.status !== "active") return { error: errors.notActive };
  if (!formationNames.includes(formation as Formation)) return { error: errors.invalidFormation };
  if (await hasLiveFixture(db, draft.id)) return { error: errors.matchLive };
  const error = await saveDraft(db, draft, { formation });
  if (error) return { error };
  draftPaths(); return { ok: true };
}

/** Gir opp en solo-draft. Du får premien for seirene du har så langt. */
export async function abandonDraftAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  void _prev; void _formData;
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const draft = await runningDraft(db, user.id);
  if (!draft || draft.room_id) return { error: errors.notActive };
  if (await hasLiveFixture(db, draft.id)) return { error: errors.matchLive };
  const { error } = await db.rpc("finish_draft", { target_draft: draft.id, final_status: "eliminated" });
  if (error) return { error: await dbErrorMessage(error) };
  draftPaths(); return { ok: true };
}

// ---------------------------------------------------------------------------
// Kampene
// ---------------------------------------------------------------------------

export async function playDraftFixtureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const fixtureId = String(formData.get("fixture_id") ?? "");
  const { data } = await db.from("career_draft_fixtures").select("*").eq("id", fixtureId).maybeSingle();
  const fixture = data as FixtureRow | null;
  if (!fixture) return { error: errors.matchNotFound };
  if (!fixture.home_draft_id) return { error: errors.matchNotReady };
  if (fixture.status !== "scheduled" && fixture.status !== "live") return { error: errors.matchNotReady };
  const draftIds = [fixture.home_draft_id, fixture.away_draft_id].filter((id): id is string => Boolean(id));
  const { data: draftRows } = await db.from("career_drafts").select(draftColumns).in("id", draftIds);
  const drafts = new Map(((draftRows ?? []) as unknown as DraftRow[]).map((row) => [row.id, row]));
  const home = drafts.get(fixture.home_draft_id); const away = fixture.away_draft_id ? drafts.get(fixture.away_draft_id) : null;
  if (!home || (fixture.away_draft_id && !away) || (home.user_id !== user.id && away?.user_id !== user.id)) return { error: errors.matchNotFound };
  if (fixture.status === "live" && fixture.match_id) redirect(`/managerkarriere/kamp/${fixture.match_id}`);
  const limitError = await managerMatchLimitError(user.id);
  if (limitError) return { error: limitError };

  const homeTeam = draftTeamSnapshot(home.user_id, home.formation, home.players ?? {});
  const awayTeam: ManagerTeamSnapshot | null = away ? draftTeamSnapshot(away.user_id, away.formation, away.players ?? {}) : aiDraftSide(fixture.away_ai as DraftAiSide | null);
  if (!homeTeam || !awayTeam) return { error: errors.matchNotReady };
  const matchId = crypto.randomUUID();
  // Draftkamper er utslagskamper: likt etter 90′ gir ekstraomganger og straffer.
  const events = planManagerTimeline(matchId, [{ type: "kickoff", version: MANAGER_KICKOFF_VERSION, home: homeTeam, away: awayTeam, knockout: true, ratingWeight: DRAFT_RATING_WEIGHT }]);
  const { data: startedMatch, error } = await db.rpc("start_draft_match", {
    target_user: user.id, target_fixture: fixture.id, new_match: matchId, match_events: events,
    expected_home_updated: home.updated_at, expected_away_updated: away?.updated_at ?? null,
  });
  if (error) return { error: await dbErrorMessage(error) };
  if (!startedMatch) return { error: errors.matchNotReady };
  draftPaths();
  redirect(`/managerkarriere/kamp/${startedMatch}`);
}

// ---------------------------------------------------------------------------
// Venneturneringen
// ---------------------------------------------------------------------------

export async function createDraftRoomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const invited = [...new Set(formData.getAll("friend_id").map(String))].filter((id) => id && id !== user.id);
  if (!invited.length) return { error: errors.pickFriends };
  if (invited.length > ROOM_SIZE - 1) return { error: errors.roomFull };
  for (const friendId of invited) if (!(await friendshipId(user.id, friendId))) return { error: errors.friendsOnly };
  const { error } = await db.rpc("create_draft_room_with_payment", { target_user: user.id, invited, use_token: formData.get("payment") === "token" });
  if (error) return { error: await dbErrorMessage(error) };
  draftPaths(); return { ok: true };
}

export async function inviteToDraftRoomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const roomId = String(formData.get("room_id") ?? ""); const friendId = String(formData.get("friend_id") ?? "");
  const { data: room } = await db.from("career_draft_rooms").select("host_id, status").eq("id", roomId).maybeSingle();
  if (!room || room.host_id !== user.id) return { error: errors.onlyHost };
  if (room.status !== "open") return { error: errors.roomStarted };
  if (!(await friendshipId(user.id, friendId))) return { error: errors.friendsOnly };
  const { error } = await db.from("career_draft_room_members").upsert({ room_id: roomId, user_id: friendId }, { onConflict: "room_id,user_id", ignoreDuplicates: true });
  if (error) return { error: await dbErrorMessage(error) };
  draftPaths(); return { ok: true };
}

export async function respondDraftInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const roomId = String(formData.get("room_id") ?? "");
  const answer = formData.get("answer");
  if (answer !== "join" && answer !== "join_token" && answer !== "decline") return { error: (await getT()).dbErrors.invalidAnswer };
  if (answer === "join" || answer === "join_token") {
    const { error } = await db.rpc("start_draft_with_payment", { target_user: user.id, target_room: roomId, use_token: answer === "join_token" });
    if (error) return { error: await dbErrorMessage(error) };
  } else {
    const { error } = await db.from("career_draft_room_members").delete().eq("room_id", roomId).eq("user_id", user.id).eq("status", "invited");
    if (error) return { error: await dbErrorMessage(error) };
  }
  draftPaths(); return { ok: true };
}

/** Går ut av en venneturnering før den starter (innsatsen betales tilbake). Verten avlyser hele turneringen. */
export async function leaveDraftRoomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { error } = await supabaseAdmin().rpc("leave_draft_room", { target_user: user.id, target_room: String(formData.get("room_id") ?? "") });
  if (error) return { error: await dbErrorMessage(error) };
  draftPaths(); return { ok: true };
}

/** Bracket-plassene i rekkefølge, så managerne spres utover og møtes så sent som mulig. */
const spreadOrder = [0, 4, 2, 6, 1, 5, 3, 7];

export async function startDraftRoomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(); const db = supabaseAdmin();
  const errors = (await getT()).draft.errors;
  const roomId = String(formData.get("room_id") ?? "");
  const { data: room } = await db.from("career_draft_rooms").select("host_id, status").eq("id", roomId).maybeSingle();
  if (!room || room.host_id !== user.id) return { error: errors.onlyHost };
  if (room.status !== "open") return { error: errors.roomStarted };
  const { data: rows } = await db.from("career_drafts").select(draftColumns).eq("room_id", roomId).in("status", ["drafting", "active"]);
  const drafts = (rows ?? []) as unknown as DraftRow[];
  if (drafts.some((draft) => draft.status === "drafting")) return { error: errors.everyoneMustFinish };
  if (drafts.length < 2) return { error: errors.needTwo };
  // AI-lagene som fyller bracketen er omtrent like gode som managerne.
  const ratings = drafts.map((draft) => draftRating(draft.players ?? {}) ?? 75);
  const average = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
  const pool = await draftPool(db);
  const usedNames = new Set<string>();
  const humans = [...drafts].sort(() => Math.random() - 0.5);
  const entries: ({ draft_id: string } | { ai: DraftAiSide })[] = Array.from({ length: ROOM_SIZE });
  humans.forEach((draft, index) => { entries[spreadOrder[index]] = { draft_id: draft.id }; });
  for (let index = 0; index < ROOM_SIZE; index += 1) if (!entries[index]) entries[index] = { ai: aiDraftTeam(pool, average + Math.round(Math.random() * 3) - 2, usedNames) };
  const { error } = await db.rpc("start_draft_room", { target_user: user.id, target_room: roomId, entries });
  if (error) return { error: await dbErrorMessage(error) };
  draftPaths(); return { ok: true };
}
