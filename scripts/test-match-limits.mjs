import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDraftTestDb } from "./draft-test-db.mjs";
const db = await createDraftTestDb(true);
await db.exec(readFileSync(new URL('../supabase/migrations/0097_managerkamp_grenser.sql',import.meta.url),'utf8'));
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const one=async(sql,args=[]) => (await query(sql,args))[0];
const user=async() => {
  const {id}=await one("insert into profiles(username) values('limit tester') returning id");
  await query('insert into player_profiles(user_id,manager_budget) values($1,100)',[id]);
  return id;
};
const seed=async(home,away=null,{direct=false,age='5 minutes',mode='manager',status='completed'}={}) => {
  const challenge=direct?crypto.randomUUID():null;
  return (await one("insert into career_matches(mode,status,home_user_id,away_user_id,challenge_id,started_at) values($1,$2,$3,$4,$5,now()-$6::interval) returning id",[mode,status,home,away,challenge,age])).id;
};
// Daily: draft RPC shares the same counter with AI/season matches, and the 40th is allowed.
const a=await user();
for(let n=0;n<39;n++) await seed(a,null,{age:'2 hours'});
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

// Old direct games fall outside the rolling hour but still count toward the day.
const e=await user(),f=await user();
for(let n=0;n<5;n++) await seed(e,f,{direct:true,age:'61 minutes'});
for(let n=0;n<5;n++) await seed(e,f,{direct:true});
await assert.rejects(()=>seed(e,f,{direct:true}),/Maks 5 direkte/);
// Other modes and games older than 24 hours do not use the manager daily quota.
const g=await user();
for(let n=0;n<42;n++) await seed(g,null,{mode:'other'});
for(let n=0;n<42;n++) await seed(g,null,{age:'25 hours'});
await seed(g);

// A second player cannot start a draft game against someone who has used all 40 daily slots.
const h=await user(),i=await user();
for(let n=0;n<40;n++) await seed(h,null,{age:'2 hours'});
await assert.rejects(()=>seed(i,h),/grensen på 40/);
// A started game uses one slot even if it is not completed yet.
const j=await user();
for(let n=0;n<39;n++) await seed(j,null,{age:'2 hours'});
await seed(j,null,{status:'live'});
await assert.rejects(()=>seed(j),/grensen på 40/);
console.log('Match limits passed: draft inside 40/day, 5 direct friend games/hour, rolling windows, both participants, lobby rollback and continuation at cap.');
await db.close();
