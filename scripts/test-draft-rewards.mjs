import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createDraftTestDb } from "./draft-test-db.mjs";
const db = await createDraftTestDb(true);
const query = async (sql, params=[]) => (await db.query(sql, params)).rows;
const one = async (sql, params=[]) => (await query(sql,params))[0];
const user = async (mb=100,tokens=0) => {
  const {id} = await one("insert into profiles(username) values('reward tester') returning id");
  await query("insert into player_profiles(user_id,manager_budget,draft_tokens) values($1,$2,$3)",[id,mb,tokens]);
  return id;
};
const wallet = (id) => one("select manager_budget as mb,draft_tokens as tokens from player_profiles where user_id=$1",[id]);
const prices = new Map((await query('select key,price from manager_packs')).map(p=>[p.key,p.price]));
const options = await query('select * from career_draft_reward_options order by mode,wins,id');
const value = (o)=>o.mb+o.tokens*50+o.packs.reduce((sum,p)=>sum+p.quantity*prices.get(p.key),0);
for (const mode of ['solo','room']) {
  const max = mode==='solo'?5:3;
  let previousMin = 0;
  for (let wins=0;wins<=max;wins++) {
    const tier=options.filter(o=>o.mode===mode && o.wins===wins);
    assert.ok(tier.length>=3);
    assert.equal(tier.reduce((s,o)=>s+o.weight,0),100);
    assert.ok(tier.every(o=>o.packs.every(p=>prices.has(p.key) && p.quantity>0)));
    assert.ok(Math.min(...tier.map(value))>=previousMin);
    previousMin=Math.min(...tier.map(value));
    if (wins===max) assert.ok(tier.every(o=>value(o)>=350));
    if (wins===0) assert.equal(tier.filter(o=>o.tokens>0).reduce((s,o)=>s+o.weight,0),5);
    else assert.ok(tier.every(o=>o.packs.length>0));
  }
}
const champion = (mode,max)=>options.filter(o=>o.mode===mode && o.wins===max).map(({mb,packs,tokens,weight})=>({mb,packs,tokens,weight}));
assert.deepEqual(champion('solo',5),champion('room',3));
const exclusives=await query("select * from manager_packs where key like 'draft_%'");
assert.equal(exclusives.length,4);
assert.ok(exclusives.every(p=>p.active && !p.purchasable));
for (const pack of exclusives) {
  assert.ok(pack.guarantees.reduce((sum,g)=>sum+g.count,0)<=pack.card_count);
  assert.ok(pack.odds.every(b=>b.min<=b.max && b.weight>0));
  assert.ok(pack.guarantees.every(g=>pack.odds.some(b=>b.max>=g.min)));
}

// Every possible combo is paid exactly once, independent of a second finish request.
for (const option of options) {
  await query('begin');
  // A deterministic random draw in PostgreSQL is not exposed to clients. For this test, keep one tier option.
  await query('delete from career_draft_reward_options where mode=$1 and wins=$2 and id<>$3',[option.mode,option.wins,option.id]);
  const id=await user(100);
  const room=option.mode==='room'?(await one('insert into career_draft_rooms(host_id) values($1) returning id',[id])).id:null;
  const draft=(await one("insert into career_drafts(user_id,room_id,status,wins,entry_fee) values($1,$2,'active',$3,50) returning id",[id,room,option.wins])).id;
  await one("select finish_draft($1,$2)",[draft,option.wins===(option.mode==='solo'?5:3)?'champion':'eliminated']);
  const result=await one('select reward_mb,reward_packs,reward_tokens,reward_option_id from career_drafts where id=$1',[draft]);
  assert.deepEqual(result,{reward_mb:option.mb,reward_packs:option.packs,reward_tokens:option.tokens,reward_option_id:option.id});
  assert.deepEqual(await wallet(id),{mb:100+option.mb,tokens:option.tokens});
  assert.deepEqual((await query('select pack_key as key,quantity from manager_pack_inventory where user_id=$1 order by pack_key',[id])),[...option.packs].sort((a,b)=>a.key.localeCompare(b.key)));
  await one("select finish_draft($1,'champion')",[draft]);
  assert.deepEqual(await wallet(id),{mb:100+option.mb,tokens:option.tokens});
  assert.equal((await one('select count(*)::int as n from career_reward_events where source_id=$1',[draft])).n,1);
  await query('rollback');
}
// Explicit payment choice: a token never pays MB and does not get converted to MB on cancellation.
const tokenHost=await user(0,2), guest=await user(100,1);
const room=(await one('select create_draft_room_with_payment($1,$2,true) as id',[tokenHost,[guest]])).id;
assert.deepEqual(await wallet(tokenHost),{mb:0,tokens:1});
await one('select start_draft_with_payment($1,$2,false)',[guest,room]);
assert.deepEqual(await wallet(guest),{mb:50,tokens:1});
await one('select leave_draft_room($1,$2)',[tokenHost,room]);
await one('select leave_draft_room($1,$2)',[tokenHost,room]).then(()=>assert.fail('cancelled room must reject second refund'),()=>{});
assert.deepEqual(await wallet(tokenHost),{mb:0,tokens:2});
assert.deepEqual(await wallet(guest),{mb:100,tokens:1});

const empty=await user(100,0);
await assert.rejects(()=>one('select start_draft_with_payment($1,null,true)',[empty]),/Du har ingen draft tokens/);
assert.deepEqual(await wallet(empty),{mb:100,tokens:0});
assert.equal((await one('select count(*)::int as n from career_drafts where user_id=$1',[empty])).n,0);
// A guest can also pay with a token and leave without affecting the host's entry.
const guestRoom=(await one('select create_draft_room_with_payment($1,$2,true) as id',[tokenHost,[guest]])).id;
await one('select start_draft_with_payment($1,$2,true)',[guest,guestRoom]);
assert.deepEqual(await wallet(guest),{mb:100,tokens:0});
await one('select leave_draft_room($1,$2)',[guest,guestRoom]);
await one('select leave_draft_room($1,$2)',[guest,guestRoom]);
assert.deepEqual(await wallet(guest),{mb:100,tokens:1});
assert.deepEqual(await wallet(tokenHost),{mb:0,tokens:1});
await one('select leave_draft_room($1,$2)',[tokenHost,guestRoom]);
assert.deepEqual(await wallet(tokenHost),{mb:0,tokens:2});

// Transfer an existing token-paid solo without spending another token; leaving returns the original token.
const transfer=(await one('select start_draft_with_payment($1,null,true) as id',[tokenHost])).id;
const room2=(await one('select create_draft_room_with_payment($1,$2,true) as id',[tokenHost,[guest]])).id;
assert.deepEqual(await wallet(tokenHost),{mb:0,tokens:1});
assert.equal((await one('select draft_id from career_draft_room_members where room_id=$1 and user_id=$2',[room2,tokenHost])).draft_id,transfer);
await one('select leave_draft_room($1,$2)',[tokenHost,room2]);
assert.deepEqual(await wallet(tokenHost),{mb:0,tokens:2});

// Real weighted draws vary but remain inside the zero-win pool, including for giving up before a match.
const seen=new Set();
for (let i=0;i<80;i++) {
  const id=await user(100);
  const draft=(await one('select start_draft_with_payment($1,null,false) as id',[id])).id;
  await one("select finish_draft($1,'eliminated')",[draft]);
  const {reward_option_id}=await one('select reward_option_id from career_drafts where id=$1',[draft]);
  assert.ok(options.some(o=>o.id===reward_option_id && o.mode==='solo' && o.wins===0));
  seen.add(reward_option_id);
}
assert.ok(seen.size>=2);
for (const fn of ['start_draft_with_payment(uuid,uuid,boolean)','create_draft_room_with_payment(uuid,uuid[],boolean)']) {
  assert.equal((await one("select has_function_privilege('anon',$1,'execute') as allowed",['public.'+fn])).allowed,false);
  assert.equal((await one("select has_function_privilege('authenticated',$1,'execute') as allowed",['public.'+fn])).allowed,false);
}
// Open every exclusive reward using the real production pack drawing/delivery/free-opening functions.
await db.exec(`
alter table manager_packs add column untradable boolean not null default false;
alter table manager_packs add column weekly_limit integer;
alter table manager_packs add column daily_purchase_limit integer;
alter table manager_packs add column available_from timestamptz;
alter table manager_packs add column available_until timestamptz;
alter table manager_packs add column inform_max_overall integer;
create table player_catalog(id uuid primary key default gen_random_uuid(),slug text,name text,position text,overall integer,attributes jsonb default '{}',price integer,accent text,club text,active boolean default true);
create table special_cards(id uuid primary key,catalog_id uuid,overall integer,attributes jsonb,price integer,kind text,round_id uuid);
create table manager_cards(id uuid primary key default gen_random_uuid(),owner_id uuid,catalog_id uuid,name text,position text,overall integer,attributes jsonb,acquired_price integer,location text,special_card_id uuid,tradable boolean);
create table pack_openings(user_id uuid,pack_key text,price integer,pulls jsonb,created_at timestamptz default now());
create function sbc_week_bounds() returns jsonb language sql as $$select jsonb_build_object('week_start',now()-interval '7 days')$$;
create function manager_squad_capacity() returns integer language sql as $$select 10000$$;
create function manager_storage_capacity() returns integer language sql as $$select 10000$$;
create function manager_inform_factor(target_user uuid) returns numeric language sql as $$select 1$$;
create function draw_special_card(scope text,excluded uuid[]) returns uuid language sql as $$select null::uuid$$;
insert into player_catalog(slug,name,position,overall,price) select 'test-'||rating||'-'||copy,'Player '||rating||'-'||copy,'CM',rating,rating from generate_series(40,99) rating cross join generate_series(1,12) copy;
`);
function productionFunction(file,name) {
  const source=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  const start=source.indexOf('create or replace function public.'+name+'(');
  assert.ok(start>=0);
  const end=source.indexOf('$fn$;',source.indexOf('as $fn$',start))+5;
  return source.slice(start,end);
}
await db.exec(productionFunction('0034_fc_economy.sql','draw_pack_card'));
await db.exec(productionFunction('0084_ungdomstoooor_inform_cap.sql','deliver_manager_pack'));
await db.exec(productionFunction('0060_special_cards.sql','open_free_manager_pack'));
const opener=await user(1000);
for (const pack of exclusives) {
  await one('select grant_pack($1,$2,1)',[opener,pack.key]);
  const {pulls}=await one('select open_free_manager_pack($1,$2) as pulls',[opener,pack.key]);
  assert.equal(pulls.length,pack.card_count);
  assert.equal(new Set(pulls.map(card=>card.catalog_id)).size,pack.card_count);
  const min=Math.min(...pack.odds.map(b=>b.min));
  assert.ok(pulls.every(card=>card.overall>=min));
  const remaining=pulls.map(card=>card.overall).sort((a,b)=>b-a);
  for (const guarantee of [...pack.guarantees].sort((a,b)=>b.min-a.min)) {
    for (let n=0;n<guarantee.count;n++) assert.ok(remaining.shift()>=guarantee.min);
  }
  await assert.rejects(()=>one('select open_free_manager_pack($1,$2)',[opener,pack.key]),/ingen gratis pakker/);
  await assert.rejects(()=>one('select deliver_manager_pack($1,$2,true)',[opener,pack.key]),/kan ikke kjøpes/);
}
assert.deepEqual(await wallet(opener),{mb:1000,tokens:0});
assert.equal((await one('select count(*)::int as n from pack_openings where user_id=$1 and price=0',[opener])).n,4);
console.log('Draft rewards passed: all combinations, 350 MB champion floor, equal champion pools, 5% token weight, tokens, refunds, no double awards, random draws and all four exclusive packs opened with production SQL.');
await db.close();
