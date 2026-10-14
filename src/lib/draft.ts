import "server-only";

import type { TeamView } from "./ai-opponent";
import { DRAFT_ENTRY_FEE, draftReward, draftFormation, draftRating, draftTeamSnapshot, SOLO_ROUNDS, type DraftPlayer, type DraftStatus, type DraftReward, type DraftRewardPack, type DraftRewardOption } from "./draft-core";
import { listFriends } from "./friends";
import type { Formation } from "./lineup";
import type { ManagerTeamSnapshot } from "./manager-match";
import type { SpecialKind } from "./special-cards";
import { supabaseAdmin } from "./supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

// ---------------------------------------------------------------------------
// Spillerpoolen: hele katalogen pluss spesialkortene
// ---------------------------------------------------------------------------

import { aiDraftTeam, soloOpponentRating, type DraftAiSide, type PoolCard } from "./draft-generation";
export { aiDraftTeam, drawOptions, isTaken, takenKeys, type DraftAiSide } from "./draft-generation";
type CatalogRow = { id: string; slug: string; name: string; position: string; overall: number; club: string | null; league: string | null; nation: string | null; accent: string | null; attributes: Record<string, number> | null; active: boolean };
type SpecialRow = { id: string; kind: string; catalog_id: string; overall: number; attributes: Record<string, number> | null };

/** PostgREST gir høyst 1000 rader om gangen, og katalogen er større enn det. */
async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

const specialKinds = new Set<SpecialKind>(["inform", "tots", "icon", "honorable"]);

export async function draftPool(db: Db): Promise<{ normal: PoolCard[]; special: PoolCard[] }> {
  const [catalog, specials] = await Promise.all([
    allRows<CatalogRow>((from, to) => db.from("player_catalog").select("id, slug, name, position, overall, club, league, nation, accent, attributes, active").order("id").range(from, to)),
    allRows<SpecialRow>((from, to) => db.from("special_cards").select("id, kind, catalog_id, overall, attributes").order("id").range(from, to)),
  ]);
  const byId = new Map(catalog.map((row) => [row.id, row]));
  const card = (row: CatalogRow, overall: number, attributes: Record<string, number> | null, special: SpecialKind | null): PoolCard => ({
    catalogId: row.id, name: row.name, position: row.position, overall, slug: row.slug, club: row.club ?? null, league: row.league ?? null, nation: row.nation ?? null, accent: row.accent ?? null, attributes: attributes ?? {}, special,
  });
  const normal = catalog.filter((row) => row.active).map((row) => card(row, row.overall, row.attributes, null));
  const special = specials.flatMap((row) => {
    const base = byId.get(row.catalog_id);
    return base && specialKinds.has(row.kind as SpecialKind) ? [card(base, row.overall, row.attributes ?? base.attributes, row.kind as SpecialKind)] : [];
  });
  return { normal, special };
}

// ---------------------------------------------------------------------------
// Siden
// ---------------------------------------------------------------------------

export type DraftRow = { id: string; user_id: string; room_id: string | null; status: DraftStatus; formation: string | null; offers: Record<string, DraftPlayer[]>; players: Record<string, DraftPlayer>; captain_id: string | null; wins: number; entry_fee: number; reward_mb: number | null; reward_pack: string | null; reward_packs: DraftRewardPack[] | null; reward_tokens: number; created_at: string; updated_at: string; finished_at: string | null };
export type FixtureRow = { id: string; draft_id: string | null; room_id: string | null; round: number; slot: number; home_draft_id: string | null; away_draft_id: string | null; home_ai: DraftAiSide | null; away_ai: DraftAiSide | null; status: "waiting" | "scheduled" | "live" | "completed"; match_id: string | null; home_score: number | null; away_score: number | null; home_penalties: number | null; away_penalties: number | null; winner: "home" | "away" | null };

export const draftColumns = "id, user_id, room_id, status, formation, offers, players, captain_id, wins, entry_fee, reward_mb, reward_pack, reward_packs, reward_tokens, created_at, updated_at, finished_at";
const fixtureColumns = "id, draft_id, room_id, round, slot, home_draft_id, away_draft_id, home_ai, away_ai, status, match_id, home_score, away_score, home_penalties, away_penalties, winner";

export type DraftSide = { name: string; rating: number | null; mine: boolean; userId: string | null; team: TeamView | null };
export type DraftFixture = { id: string; round: number; slot: number; status: FixtureRow["status"]; matchId: string | null; home: DraftSide | null; away: DraftSide | null; homeScore: number | null; awayScore: number | null; homePenalties: number | null; awayPenalties: number | null; winner: "home" | "away" | null; mine: boolean };
export type DraftView = { id: string; mode: "solo" | "room"; status: DraftStatus; formation: Formation | null; players: Record<string, DraftPlayer>; offers: Record<string, DraftPlayer[]>; captainId: string | null; wins: number; rating: number | null; rewardMb: number | null; rewardPack: string | null; reward: DraftReward; finishedAt: string | null };
export type DraftRoomMember = { userId: string; username: string; status: "invited" | "joined"; draftStatus: DraftStatus | null; rating: number | null; picks: number };
export type DraftRoom = { id: string; hostId: string; hostName: string; status: "open" | "playing" | "completed" | "cancelled"; members: DraftRoomMember[]; fixtures: DraftFixture[] };
export type DraftInvite = { roomId: string; hostName: string; joined: number };
export type DraftFriend = { id: string; username: string; drafting: boolean };
export type DraftHistoryEntry = { id: string; mode: "solo" | "room"; status: DraftStatus; wins: number; rewardMb: number | null; rewardPack: string | null; reward: DraftReward; finishedAt: string | null };
export type DraftPageData = { userId: string; entryFee: number; current: DraftView | null; last: DraftView | null; room: DraftRoom | null; fixtures: DraftFixture[]; invites: DraftInvite[]; friends: DraftFriend[]; history: DraftHistoryEntry[]; packNames: Record<string, string>; tokens: number; rewardOptions: DraftRewardOption[] };

function toView(row: DraftRow): DraftView {
  const players = row.players ?? {};
  return { id: row.id, mode: row.room_id ? "room" : "solo", status: row.status, formation: draftFormation(row.formation), players, offers: row.offers ?? {}, captainId: row.captain_id, wins: row.wins, rating: draftRating(players), rewardMb: row.reward_mb, rewardPack: row.reward_pack, reward: draftReward(row.reward_mb, row.reward_packs, row.reward_pack, row.reward_tokens), finishedAt: row.finished_at };
}

function teamView(name: string, subtitle: string | null, team: ManagerTeamSnapshot | null, kind: TeamView["kind"]): TeamView | null {
  return team ? { name, subtitle, formation: team.formation, starters: team.starters, bench: team.bench, kind } : null;
}

/** Lager neste solo-kamp når forrige er vunnet, så motstanderen kan vises før du spiller. */
async function ensureSoloFixture(db: Db, draft: DraftRow, fixtures: FixtureRow[]): Promise<boolean> {
  if (draft.room_id || draft.status !== "active") return false;
  const round = draft.wins + 1;
  if (round > SOLO_ROUNDS || fixtures.some((fixture) => fixture.round === round)) return false;
  const own = draftRating(draft.players ?? {}) ?? 75;
  const pool = await draftPool(db);
  const used = new Set(fixtures.map((fixture) => fixture.away_ai?.name).filter((name): name is string => Boolean(name)));
  const opponent = aiDraftTeam(pool, soloOpponentRating(own, round), used);
  const { error } = await db.from("career_draft_fixtures").upsert({ draft_id: draft.id, round, slot: 0, home_draft_id: draft.id, away_ai: opponent, status: "scheduled" }, { onConflict: "draft_id,round", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return true;
}

export async function getDraftPage(userId: string): Promise<DraftPageData> {
  const db = supabaseAdmin();
  const { error: settleError } = await db.rpc("settle_draft_matches", { target_user: userId });
  if (settleError) throw new Error(settleError.message);
  const [{ data: drafts, error }, friends, { data: inviteRows }, { data: packs }, { data: wallet, error: walletError }, { data: options, error: optionsError }] = await Promise.all([
    db.from("career_drafts").select(draftColumns).eq("user_id", userId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(12),
    listFriends(userId),
    db.from("career_draft_room_members").select("room_id, career_draft_rooms!inner(id, host_id, status)").eq("user_id", userId).eq("status", "invited").eq("career_draft_rooms.status", "open"),
    db.from("manager_packs").select("key, name, price"),
    db.from("player_profiles").select("draft_tokens").eq("user_id", userId).maybeSingle(),
    db.from("career_draft_reward_options").select("id, mode, wins, mb, packs, tokens").order("wins").order("id"),
  ]);
  if (error || walletError || optionsError) throw new Error(error?.message ?? walletError?.message ?? optionsError?.message);
  const rows = (drafts ?? []) as unknown as DraftRow[];
  const currentRow = rows.find((row) => row.status === "drafting" || row.status === "active") ?? null;
  const lastRow = currentRow ? null : rows[0] ?? null;

  // Rommet du er med i: draften din sitt rom, eller (for verten) et åpent rom.
  const roomId = (currentRow ?? lastRow)?.room_id ?? null;
  const { data: roomRow } = roomId ? await db.from("career_draft_rooms").select("id, host_id, status").eq("id", roomId).maybeSingle() : { data: null };

  let fixtureRows: FixtureRow[] = [];
  const target = currentRow ?? lastRow;
  if (target) {
    const query = db.from("career_draft_fixtures").select(fixtureColumns).order("round").order("slot");
    const { data, error: fixturesError } = await (target.room_id ? query.eq("room_id", target.room_id) : query.eq("draft_id", target.id));
    if (fixturesError) throw new Error(fixturesError.message);
    fixtureRows = (data ?? []) as unknown as FixtureRow[];
    if (currentRow && await ensureSoloFixture(db, currentRow, fixtureRows)) {
      const { data: again } = await db.from("career_draft_fixtures").select(fixtureColumns).eq("draft_id", currentRow.id).order("round");
      fixtureRows = (again ?? []) as unknown as FixtureRow[];
    }
  }

  // Alle draftene og brukerne som trengs for rommet og kampene.
  const { data: memberRows } = roomRow ? await db.from("career_draft_room_members").select("user_id, status, draft_id").eq("room_id", roomRow.id).order("invited_at") : { data: [] };
  const roomDraftIds = [...new Set([...(memberRows ?? []).map((member) => member.draft_id), ...fixtureRows.flatMap((fixture) => [fixture.home_draft_id, fixture.away_draft_id])].filter((id): id is string => Boolean(id)))];
  const { data: otherDrafts } = roomDraftIds.length ? await db.from("career_drafts").select(draftColumns).in("id", roomDraftIds) : { data: [] };
  const draftById = new Map<string, DraftRow>([...rows, ...((otherDrafts ?? []) as unknown as DraftRow[])].map((row) => [row.id, row]));
  const inviteHosts = (inviteRows ?? []).map((row) => { const room = Array.isArray(row.career_draft_rooms) ? row.career_draft_rooms[0] : row.career_draft_rooms; return room?.host_id as string | undefined; });
  const profileIds = [...new Set([...(memberRows ?? []).map((member) => member.user_id), ...[...draftById.values()].map((row) => row.user_id), ...inviteHosts.filter((id): id is string => Boolean(id)), ...(roomRow ? [roomRow.host_id] : [])])];
  const { data: profiles } = profileIds.length ? await db.from("profiles").select("id, username").in("id", profileIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.username as string]));

  const side = (draftId: string | null, ai: DraftAiSide | null): DraftSide | null => {
    if (draftId) {
      const draft = draftById.get(draftId);
      if (!draft) return null;
      const name = names.get(draft.user_id) ?? "—";
      return { name, rating: draftRating(draft.players ?? {}), mine: draft.user_id === userId, userId: draft.user_id, team: teamView(name, null, draftTeamSnapshot(draft.user_id, draft.formation, draft.players ?? {}), "real") };
    }
    return ai ? { name: ai.name, rating: ai.rating, mine: false, userId: null, team: teamView(ai.name, null, ai.team, "ai") } : null;
  };
  const fixtures: DraftFixture[] = fixtureRows.map((fixture) => {
    const home = side(fixture.home_draft_id, fixture.home_ai); const away = side(fixture.away_draft_id, fixture.away_ai);
    return { id: fixture.id, round: fixture.round, slot: fixture.slot, status: fixture.status, matchId: fixture.match_id, home, away, homeScore: fixture.home_score, awayScore: fixture.away_score, homePenalties: fixture.home_penalties, awayPenalties: fixture.away_penalties, winner: fixture.winner, mine: Boolean(home?.mine || away?.mine) };
  });

  const room: DraftRoom | null = roomRow ? {
    id: roomRow.id, hostId: roomRow.host_id, hostName: names.get(roomRow.host_id) ?? "—", status: roomRow.status, fixtures,
    members: (memberRows ?? []).map((member) => {
      const draft = member.draft_id ? draftById.get(member.draft_id) : undefined;
      return { userId: member.user_id, username: names.get(member.user_id) ?? "—", status: member.status, draftStatus: draft?.status ?? null, rating: draft ? draftRating(draft.players ?? {}) : null, picks: draft ? Object.keys(draft.players ?? {}).length : 0 };
    }),
  } : null;

  // Venner som drafter akkurat nå kan inviteres til en venneturnering.
  const friendIds = friends.map((friend) => friend.id);
  const { data: busy } = friendIds.length ? await db.from("career_drafts").select("user_id, updated_at").in("user_id", friendIds).in("status", ["drafting", "active"]) : { data: [] };
  const drafting = new Set((busy ?? []).map((row) => row.user_id));
  const invites: DraftInvite[] = (inviteRows ?? []).map((row, index) => ({ roomId: row.room_id, hostName: names.get(inviteHosts[index] ?? "") ?? "—", joined: 0 }));
  if (invites.length) {
    const { data: joinedRows } = await db.from("career_draft_room_members").select("room_id").in("room_id", invites.map((invite) => invite.roomId)).eq("status", "joined");
    for (const invite of invites) invite.joined = (joinedRows ?? []).filter((row) => row.room_id === invite.roomId).length;
  }

  return {
    userId,
    entryFee: DRAFT_ENTRY_FEE,
    current: currentRow ? toView(currentRow) : null,
    last: lastRow ? toView(lastRow) : null,
    room,
    fixtures,
    invites,
    friends: friends.map((friend) => ({ id: friend.id, username: friend.username, drafting: drafting.has(friend.id) })).sort((a, b) => Number(b.drafting) - Number(a.drafting) || a.username.localeCompare(b.username)),
    history: rows.filter((row) => row.status === "eliminated" || row.status === "champion").map((row) => ({ id: row.id, mode: row.room_id ? "room" : "solo", status: row.status, wins: row.wins, rewardMb: row.reward_mb, rewardPack: row.reward_pack, reward: draftReward(row.reward_mb, row.reward_packs, row.reward_pack, row.reward_tokens), finishedAt: row.finished_at })),
    tokens: wallet?.draft_tokens ?? 0,
    // Sannsynlighetene blir i databasen. Klienten får bare premieeksemplene og sammenligningsverdi.
    rewardOptions: ((options ?? []) as unknown as Omit<DraftRewardOption, "value">[]).map((option) => ({ ...option,
      value: option.mb + option.tokens * DRAFT_ENTRY_FEE + option.packs.reduce((sum, pack) => sum + pack.quantity * ((packs ?? []).find((entry) => entry.key === pack.key)?.price ?? 0), 0),
    })),
    packNames: Object.fromEntries((packs ?? []).map((pack) => [pack.key, pack.name])),
  };
}

/** Det forsiden av managerkarrieren trenger: åpne invitasjoner og om du har en draft på gang. */
export async function getDraftHub(userId: string): Promise<{ invites: number; running: boolean }> {
  const db = supabaseAdmin();
  const [{ count }, { data: running }] = await Promise.all([
    db.from("career_draft_room_members").select("room_id, career_draft_rooms!inner(status)", { count: "exact", head: true }).eq("user_id", userId).eq("status", "invited").eq("career_draft_rooms.status", "open"),
    db.from("career_drafts").select("id").eq("user_id", userId).in("status", ["drafting", "active"]).limit(1),
  ]);
  return { invites: count ?? 0, running: Boolean(running?.length) };
}
