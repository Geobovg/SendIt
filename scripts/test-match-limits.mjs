import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDraftTestDb } from "./draft-test-db.mjs";
const db = await createDraftTestDb(true);
for (const file of ['0097_managerkamp_grenser.sql','0098_managerkamp_grense_per_periode.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
// The migration inserts a reset for everyone; clear it so the tests below control the reset time themselves.
await db.query('delete from match_limit_resets');
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const one=async(sql,args=[]) => (await query(sql,args))[0];
const user=async() => {
  const {id}=await one("insert into profiles(username) values('limit tester') returning id");
  await query('insert into player_profiles(user_id,manager_budget) values($1,100)',[id]);
  return id;
};
// age: 'period' = start of the current 6-hour block in Oslo time (earliest moment that counts), 'before' = one minute before it, otherwise an interval ago.
const seed=async(home,away=null,{direct=false,age='0 seconds',mode='manager',status='completed'}={}) => {
  const challenge=direct?crypto.randomUUID():null;
  const periodStart="(date_trunc('day',now() at time zone 'Europe/Oslo')+floor(extract(hour from now() at time zone 'Europe/Oslo')/6)*interval '6 hours') at time zone 'Europe/Oslo'";
  const startedAt=age==='period'?periodStart:age==='before'?`${periodStart}-interval '1 minute'`:`now()-'${age}'::interval`;
  return (await one(`insert into career_matches(mode,status,home_user_id,away_user_id,challenge_id,started_at) values($1,$2,$3,$4,$5,${startedAt}) returning id`,[mode,status,home,away,challenge])).id;
};
// Per period: draft RPC shares the same counter with AI/season matches, and the 40th is allowed.
const a=await user();
for(let n=0;n<39;n++) await seed(a,null,{age:'period'});
const draft=(await one('select start_draft($1,null) as id',[a])).id;
await query("update career_drafts set status='active' where id=$1",[draft]);
const ai={name:'AI',rating:80,team:{}};
const fixture=(await one("insert into career_draft_fixtures(draft_id,round,home_draft_id,away_ai,status) values($1,1,$1,$2,'scheduled') returning id",[draft,ai])).id;
const stamp=(await one('select updated_at::text as stamp from career_drafts where id=$1',[draft])).stamp;
assert.ok((await one("select start_draft_match($1,$2,$3,'[]'::jsonb,$4,null) as id",[a,fixture,crypto.randomUUID(),stamp])).id);
await assert.rejects(()=>seed(a),/grensen på 40/);
// Completing and continuing an existing game must still work at the cap.
await query("update career_matches set status='completed' where id=(select match_id from career_draft_fixtures where id=$1)",[fixture]);
assert.ok((await one("select start_draft_match($1,$2,$3,'[]'::jsonb,$4,null) as id",[a,fixture,crypto.randomUUID(),stamp])).id);

// The hourly limit only counts direct challenges, for home and away players alike.
const b=await user(),c=await user();
for(let n=0;n<5;n++) await seed(b,c,{direct:true});
await assert.rejects(()=>seed(b,c,{direct:true}),/Maks 5 direkte/);
await seed(b,c); // A season/draft match is not part of the direct-match hourly cap.
const d=await user();
await assert.rejects(()=>seed(d,b,{direct:true}),/Maks 5 direkte/); // Opponent at cap, starter under it.
const lobby=(await one("insert into career_matches(mode,status,home_user_id,away_user_id,challenge_id) values('manager','lobby',$1,$2,$3) returning id",[d,b,crypto.randomUUID()])).id;
await assert.rejects(()=>query("update career_matches set status='live',started_at=now() where id=$1",[lobby]),/Maks 5 direkte/);
assert.equal((await one('select status from career_matches where id=$1',[lobby])).status,'lobby');

// Old direct games fall outside the rolling hour.
const e=await user(),f=await user();
for(let n=0;n<5;n++) await seed(e,f,{direct:true,age:'61 minutes'});
for(let n=0;n<5;n++) await seed(e,f,{direct:true});
await assert.rejects(()=>seed(e,f,{direct:true}),/Maks 5 direkte/);
// Other modes and games from before the current 6-hour period (Oslo) do not use the manager quota.
const g=await user();
for(let n=0;n<42;n++) await seed(g,null,{mode:'other'});
for(let n=0;n<42;n++) await seed(g,null,{age:'before'});
await seed(g);
// The quota resets at fixed block boundaries, not 6 hours after each game: games from just before the block never count, games from its first moment always do.
const k=await user();
for(let n=0;n<40;n++) await seed(k,null,{age:'before'});
await seed(k);
const l=await user();
for(let n=0;n<40;n++) await seed(l,null,{age:'period'});
await assert.rejects(()=>seed(l),/grensen på 40/);

// A second player cannot start a draft game against someone who has used all 40 daily slots.
const h=await user(),i=await user();
for(let n=0;n<40;n++) await seed(h,null,{age:'period'});
await assert.rejects(()=>seed(i,h),/grensen på 40/);
// A started game uses one slot even if it is not completed yet.
const j=await user();
for(let n=0;n<39;n++) await seed(j,null,{age:'period'});
await seed(j,null,{status:'live'});
await assert.rejects(()=>seed(j),/grensen på 40/);
// A global reset ignores everything started before it, for the daily cap and the hourly direct-game cap alike.
const m=await user(),n=await user(),o=await user();
for(let x=0;x<40;x++) await seed(m,null,{age:'period'});
await assert.rejects(()=>seed(m),/grensen på 40/);
for(let x=0;x<5;x++) await seed(n,o,{direct:true});
await assert.rejects(()=>seed(n,o,{direct:true}),/Maks 5 direkte/);
await query('insert into match_limit_resets(reset_at) values (now())');
await seed(m);
await seed(n,o,{direct:true});
for(let x=0;x<39;x++) await seed(m);
await assert.rejects(()=>seed(m),/grensen på 40/); // The counter starts from zero after the reset, then caps again.
console.log('Match limits passed: draft inside 40/period, 5 direct friend games/hour, 40 per fixed 6-hour Oslo block, global reset, rolling hour, both participants, lobby rollback and continuation at cap.');
await db.close();
