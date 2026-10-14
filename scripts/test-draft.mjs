import assert from "node:assert/strict";
import { createDraftTestDb } from "./draft-test-db.mjs";

const db = await createDraftTestDb();


const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
const users = [];
for (const name of ["geo", "anna", "bob"]) {
  const { id } = await one("insert into profiles (username) values ($1) returning id", [name]);
  await q("insert into player_profiles (user_id, manager_budget) values ($1, 200)", [id]);
  users.push(id);
}
const [geo, anna, bob] = users;
const budget = async (u) => (await one("select manager_budget from player_profiles where user_id = $1", [u])).manager_budget;
const expectError = async (label, fn) => { await assert.rejects(fn); console.log("Rejected:", label); };

// --- Solo ---
const { start_draft: solo } = await one("select public.start_draft($1, null)", [geo]);
assert.equal(await budget(geo), 50);
await expectError("second running draft", () => one("select public.start_draft($1, null)", [geo]));
await q("update career_drafts set status = 'active', formation = '4-3-3' where id = $1", [solo]);
const aiSide = { name: "Nordlys FC", rating: 78, team: { userId: "ai:draft:x", formation: "4-3-3", starters: [], bench: [] } };
async function playSolo(round, homeGoals, awayGoals, pens) {
  const { id: fixture } = await one("insert into career_draft_fixtures (draft_id, round, home_draft_id, away_ai, status) values ($1, $2, $1, $3, 'scheduled') returning id", [solo, round, aiSide]);
  const events = [{ type: "kickoff", version: 6, knockout: true }, { type: "sub_window_end", ms: 0 }];
  for (let i = 0; i < homeGoals; i += 1) events.push({ type: "goal", minute: 10 + i, side: "home" });
  for (let i = 0; i < awayGoals; i += 1) events.push({ type: "goal", minute: 20 + i, side: "away" });
  if (pens) for (const kick of pens) events.push({ type: "shootout_kick", ...kick });
  const { id: match } = await one("insert into career_matches (mode, home_user_id, away_ai_name, status, started_at, events) values ('manager', $1, 'Nordlys FC', 'live', now() - interval '10 minutes', $2) returning id", [geo, JSON.stringify(events)]);
  await q("update career_draft_fixtures set status = 'live', match_id = $1 where id = $2", [match, fixture]);
  const { settle_finished_manager_matches: settled } = await one("select public.settle_finished_manager_matches($1)", [match]);
  const fx = await one("select status, winner, home_score, away_score, home_penalties, away_penalties from career_draft_fixtures where id = $1", [fixture]);
  const draft = await one("select status, wins, reward_mb, reward_pack from career_drafts where id = $1", [solo]);
  assert.equal(settled, 1);
  assert.equal(fx.status, 'completed');
  assert.equal(fx.winner, homeGoals >= awayGoals ? 'home' : 'away');
  assert.equal(draft.wins, homeGoals >= awayGoals ? round : round - 1);
}
await playSolo(1, 2, 0);
await playSolo(2, 1, 1, [{ side: "home", scored: true }, { side: "away", scored: false }]);
await playSolo(3, 0, 1);

assert.equal(await budget(geo), 100);

// --- Room: geo hosts, anna and bob invited ---
await q("update player_profiles set manager_budget = 200");
const { create_draft_room: room } = await one("select public.create_draft_room($1, $2)", [geo, [anna, bob]]);
await one("select public.start_draft($1, $2)", [anna, room]);
await one("select public.start_draft($1, $2)", [bob, room]);
await expectError("start while drafting", () => one("select public.start_draft_room($1, $2, '[]'::jsonb)", [geo, room]));
await one("select public.leave_draft_room($1, $2)", [bob, room]);
assert.equal(await budget(bob), 200);
await q("update career_drafts set status = 'active' where room_id = $1 and status = 'drafting'", [room]);
const drafts = await q("select id, user_id from career_drafts where room_id = $1 and status = 'active'", [room]);
const ai = (name, rating) => ({ ai: { name, rating, team: { userId: `ai:draft:${name}`, formation: "4-3-3", starters: [], bench: [] } } });
await expectError("start by non-host", () => one("select public.start_draft_room($1, $2, '[]'::jsonb)", [anna, room]));
await expectError("bad entries", () => one("select public.start_draft_room($1, $2, $3)", [geo, room, JSON.stringify([{ draft_id: drafts[0].id }, ai("A", 80), ai("B", 80), ai("C", 80), ai("D", 80), ai("E", 80), ai("F", 80), ai("G", 80)])]));
// geo at slot 0, anna at slot 4 (spread)
const entries = [{ draft_id: drafts[0].id }, ai("A", 80), ai("B", 80), ai("C", 80), { draft_id: drafts[1].id }, ai("E", 80), ai("F", 80), ai("G", 80)];
await expectError("missing AI entry", () => one("select public.start_draft_room($1, $2, $3)", [geo, room, JSON.stringify(entries.map((entry,index)=>index===1?{}:entry))]));
await expectError("null bracket", () => one("select public.start_draft_room($1, $2, null)", [geo, room]));
await one("select public.start_draft_room($1, $2, $3)", [geo, room, JSON.stringify(entries)]);
async function playRoomFixture(round, slot, homeWins) {
  const fx = await one("select * from career_draft_fixtures where room_id = $1 and round = $2 and slot = $3", [room, round, slot]);
  const home = await one("select user_id from career_drafts where id = $1", [fx.home_draft_id]);
  const away = fx.away_draft_id ? await one("select user_id from career_drafts where id = $1", [fx.away_draft_id]) : null;
  const events = [{ type: "kickoff", version: 6, knockout: true }, { type: "sub_window_end", ms: 0 }, { type: "goal", minute: 30, side: homeWins ? "home" : "away" }];
  const { id: match } = await one("insert into career_matches (mode, home_user_id, away_user_id, away_ai_name, status, started_at, events) values ('manager', $1, $2, $3, 'live', now() - interval '10 minutes', $4) returning id", [home.user_id, away?.user_id ?? null, away ? null : "AI", JSON.stringify(events)]);
  await q("update career_draft_fixtures set status = 'live', match_id = $1 where id = $2", [match, fx.id]);
  await one("select public.settle_finished_manager_matches($1)", [match]);
}
await playRoomFixture(1, 0, true);
await playRoomFixture(1, 2, true);
const r2 = await q("select slot, status from career_draft_fixtures where room_id = $1 and round = 2", [room]);
for (const fixture of r2) if (fixture.status === "scheduled") await playRoomFixture(2, fixture.slot, true);
const final = await one("select status from career_draft_fixtures where room_id = $1 and round = 3", [room]);
if (final?.status === "scheduled") await playRoomFixture(3, 0, true);

assert.equal((await one("select status from career_draft_rooms where id = $1", [room])).status, "completed");
assert.equal((await one("select wins from career_drafts where id = $1", [solo])).wins, 2);
assert.equal((await q("select * from awards")).length, 0);
assert.equal((await q("select * from career_reward_events where source_id = $1", [solo])).length, 1);
assert.equal((await q("select * from manager_pack_inventory")).length, 2);
const prior = await budget(geo);
await one("select finish_draft($1, 'champion')", [drafts[0].id]);
assert.equal(await budget(geo), prior);
assert.equal((await q("select * from manager_pack_inventory where user_id = $1", [geo]))[0].quantity, 1);

// Atomic match creation: rejects outsiders/stale teams, reuses the match on retry.
const { start_draft: atomicDraft } = await one("select start_draft($1, null)", [bob]);
await q("update career_drafts set status = 'active' where id = $1", [atomicDraft]);
const { updated_at: stamp } = await one("select updated_at::text as updated_at from career_drafts where id = $1", [atomicDraft]);
const { id: atomicFixture } = await one("insert into career_draft_fixtures (draft_id, round, home_draft_id, away_ai, status) values ($1, 1, $1, $2, 'scheduled') returning id", [atomicDraft, aiSide]);
const start = async (user, when, id) => (await one("select start_draft_match($1,$2,$3,'[]'::jsonb,$4,null) as id", [user, atomicFixture, id, when])).id;
const id1 = crypto.randomUUID();
assert.equal(await start(geo, stamp, id1), null);
assert.equal(await start(bob, '2000-01-01', id1), null);
assert.equal(await start(bob, stamp, id1), id1);
assert.equal(await start(bob, stamp, crypto.randomUUID()), id1);
assert.equal(await start(geo, stamp, crypto.randomUUID()), null);
await assert.rejects(() => one("select finish_draft($1, 'eliminated')", [atomicDraft]), /Vent til draftkampen er ferdig/);
assert.equal((await one("select status from career_drafts where id = $1", [atomicDraft])).status, 'active');
assert.equal((await one("select count(*)::int as n from career_matches where id = $1", [id1])).n, 1);
const access = await one("select has_function_privilege('anon','public.start_draft_match(uuid,uuid,uuid,jsonb,timestamptz,timestamptz)','EXECUTE') as anon, has_function_privilege('authenticated','public.start_draft_match(uuid,uuid,uuid,jsonb,timestamptz,timestamptz)','EXECUTE') as authenticated");
assert.deepEqual(access, {anon:false, authenticated:false});
// Fem soloseire gir toppremien én gang.
await q("update player_profiles set manager_budget = 300 where user_id = $1", [geo]);
const { start_draft: champion } = await one("select start_draft($1, null)", [geo]);
await q("update career_drafts set status = 'active' where id = $1", [champion]);
for (let round = 1; round <= 5; round++) {
  const {id} = await one("insert into career_draft_fixtures (draft_id, round, home_draft_id, away_ai, status) values ($1,$2,$1,$3,'scheduled') returning id", [champion, round, aiSide]);
  const {updated_at} = await one("select updated_at::text as updated_at from career_drafts where id=$1", [champion]);
  const match = crypto.randomUUID();
  await one("select start_draft_match($1,$2,$3,'[]'::jsonb,$4,null)", [geo,id,match,updated_at]);
  await one("select record_draft_match_result($1,1,0,null,null,1)", [match]);
  await one("select record_draft_match_result($1,1,0,null,null,1)", [match]);
}
assert.deepEqual(await one("select status,wins,reward_mb,reward_pack from career_drafts where id=$1",[champion]), {status:'champion',wins:5,reward_mb:175,reward_pack:'sjeldne_spillere'});
assert.equal(await budget(geo),325);
assert.equal((await one("select quantity from manager_pack_inventory where user_id=$1 and pack_key='sjeldne_spillere'",[geo])).quantity,1);
// En kamp som ingen ser på, skal gjøres opp fra deltakerens draftside, uten å berøre andre.
await q("update career_matches set started_at = now() - interval '10 minutes' where id=$1",[id1]);
assert.equal((await one("select settle_draft_matches($1) as n",[geo])).n,0);
assert.equal((await one("select status from career_draft_fixtures where id=$1",[atomicFixture])).status,'live');
assert.equal((await one("select settle_draft_matches($1) as n",[bob])).n,1);
assert.equal((await one("select settle_draft_matches($1) as n",[bob])).n,0);
assert.equal((await one("select status from career_draft_fixtures where id=$1",[atomicFixture])).status,'completed');
await expectError('played solo cannot join a room', async () => {
  await one("select create_draft_room($1,$2)",[bob,[anna]]);
});

// Både vert og invitert kan ta med en uavspilt draft uten ny innsats.
await q("update player_profiles set manager_budget = 500");
const {start_draft: hostDraft} = await one("select start_draft($1,null)",[geo]);
const hostBudget = await budget(geo);
await q("update career_drafts set status='active',formation='4-3-3',captain_id='captain',players='{\"s0\":{\"name\":\"Keeper\"}}',offers='{\"s1\":[{\"id\":\"saved-choice\"}]}' where id=$1",[hostDraft]);
await q("insert into career_draft_fixtures(draft_id,round,home_draft_id,away_ai,status) values($1,1,$1,$2,'scheduled')",[hostDraft,aiSide]);
const {create_draft_room: transferRoom} = await one("select create_draft_room($1,$2)",[geo,[anna]]);
assert.equal(await budget(geo),hostBudget);
assert.equal((await one("select room_id from career_drafts where id=$1",[hostDraft])).room_id,transferRoom);
assert.equal((await one("select count(*)::int as n from career_draft_fixtures where draft_id=$1",[hostDraft])).n,0);
const saved = await one("select captain_id,formation,players,offers from career_drafts where id=$1",[hostDraft]);
assert.equal(saved.captain_id,'captain');
assert.equal(saved.formation,'4-3-3');
assert.deepEqual(saved.players,{s0:{name:'Keeper'}});
assert.deepEqual(saved.offers,{s1:[{id:'saved-choice'}]});
const {start_draft: guestDraft} = await one("select start_draft($1,null)",[anna]);
await q("update player_profiles set manager_budget=0 where user_id=$1",[anna]);
assert.equal((await one("select start_draft($1,$2) as id",[anna,transferRoom])).id,guestDraft);
assert.equal(await budget(anna),0);
await expectError('cannot join twice', () => one("select start_draft($1,$2)",[anna,transferRoom]));
await one("select leave_draft_room($1,$2)",[geo,transferRoom]);
assert.equal(await budget(geo),hostBudget+150);
assert.equal(await budget(anna),150);
assert.equal((await one("select status from career_drafts where id=$1",[guestDraft])).status,'cancelled');
// Klienten bruker PostgREST-strengen, ikke JavaScript Date som mister mikrosekundene.
const beforeTouch = await one("select updated_at::text as stamp from career_drafts where id=$1",[guestDraft]);
await q("update career_drafts set updated_at='2000-01-01' where id=$1",[guestDraft]);
assert.equal((await one("select updated_at > $2::timestamptz as advanced from career_drafts where id=$1",[guestDraft,beforeTouch.stamp])).advanced,true);
console.log('All draft assertions passed');
await db.close();
