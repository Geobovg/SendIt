// Tester Brødrestevnet brooor (migrering 0114) mot en PGlite-database med forenklede tabeller.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table profiles (id uuid primary key default gen_random_uuid());
create table player_profiles (user_id uuid primary key references profiles(id));
create table player_catalog (id uuid primary key default gen_random_uuid(), slug text, name text, position text, overall int, price int, accent text, club text, attributes jsonb default '{}', active boolean default true);
create table special_cards (id uuid primary key default gen_random_uuid(), kind text, catalog_id uuid references player_catalog(id), overall int, price int, attributes jsonb);
create table manager_cards (id uuid primary key default gen_random_uuid(), owner_id uuid, catalog_id uuid, name text, position text, overall int, attributes jsonb, acquired_price int, location text, special_card_id uuid, tradable boolean);
create table manager_packs (key text primary key, name text, description text, price int, card_count int, guarantee_min int, guarantee_count int, guarantees jsonb, odds jsonb, accent text, sort_order int,
  inform_chance numeric, tots_chance numeric, icon_chance numeric, honorable_chance numeric, special_guarantee int, special_scope text default 'current' check (special_scope in ('current', 'all', 'tots')), purchasable boolean, active boolean);
create table manager_pack_inventory (user_id uuid not null references profiles(id), pack_key text not null references manager_packs(key), quantity int not null default 0, updated_at timestamptz default now(), primary key (user_id, pack_key));
create function manager_squad_capacity() returns integer language sql as $$ select 23 $$;
create function grant_pack(target_user uuid, target_pack text, amount integer) returns void language sql as $$
  insert into manager_pack_inventory (user_id, pack_key, quantity) select target_user, target_pack, amount where amount > 0
  on conflict (user_id, pack_key) do update set quantity = manager_pack_inventory.quantity + excluded.quantity $$;
-- Forenklet trekning (den ekte heter draw_special_card og får nytt navn i migreringen).
create function draw_special_card(scope text, excluded uuid[]) returns uuid language sql volatile as $$
  select id from special_cards where kind = case scope when 'honorable' then 'honorable' else 'inform' end and id <> all(coalesce(excluded, '{}')) order by random() limit 1 $$;
-- Forenklet pakkeåpning: ett spesialkort via draw_special_card(special_scope).
create function deliver_manager_pack(target_user uuid, target_pack text, paid boolean) returns jsonb language plpgsql as $$
declare pack manager_packs%rowtype; picked uuid; special special_cards%rowtype;
begin
  select * into pack from manager_packs where key = target_pack and active;
  picked := draw_special_card(pack.special_scope, '{}');
  if picked is null then raise exception 'Det finnes ingen spesialkort å trekke ennå'; end if;
  select * into special from special_cards where id = picked;
  insert into manager_cards (owner_id, catalog_id, name, position, overall, location, special_card_id, tradable) values (target_user, special.catalog_id, 'x', 'CM', special.overall, 'squad', special.id, true);
  return jsonb_build_array(jsonb_build_object('special', special.kind));
end $$;
create function open_free_manager_pack(target_user uuid, target_pack text) returns jsonb language sql as $$ select '[]'::jsonb $$;
`);
await db.exec(`
insert into player_catalog (slug, name, position, overall, price, accent, club)
select 'p' || n, 'Spiller ' || n, 'CM', 70 + n, 1000, '#35d06a', 'Klubb' from generate_series(1, 30) n;
insert into special_cards (kind, catalog_id, overall, price) select 'inform', id, 85, 5000 from player_catalog where slug = 'p1';
insert into special_cards (kind, catalog_id, overall, price) select 'honorable', id, 88, 4000 from player_catalog where slug = 'p2';
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0114_brodrestevnet_brooor.sql", import.meta.url), "utf8"));

const user = (await db.query("insert into profiles default values returning id")).rows[0].id;
const noProfile = (await db.query("insert into profiles default values returning id")).rows[0].id;
await db.query("insert into player_profiles values ($1)", [user]);
const inventory = async (id) => (await db.query("select coalesce(sum(quantity), 0)::int as n from manager_pack_inventory where user_id = $1 and pack_key = 'brodrestevnet_brooor'", [id])).rows[0].n;

// Pakken finnes, kan ikke kjøpes og har ikke noe tidsvindu selv.
const pack = (await db.query("select * from manager_packs where key = 'brodrestevnet_brooor'")).rows[0];
assert.equal(pack.card_count, 1); assert.equal(pack.special_guarantee, 1); assert.equal(pack.special_scope, "mix"); assert.equal(pack.purchasable, false);

// Gaven: én gang per manager, ikke uten managerprofil, og ikke etter fristen.
assert.equal((await db.query("select claim_event_gifts($1) as n", [noProfile])).rows[0].n, 0);
assert.equal(await inventory(noProfile), 0);
assert.equal((await db.query("select claim_event_gifts($1) as n", [user])).rows[0].n, 1);
assert.equal((await db.query("select claim_event_gifts($1) as n", [user])).rows[0].n, 0);
assert.equal(await inventory(user), 1);
await db.query("update event_gifts set available_until = now() - interval '1 minute'");
const late = (await db.query("insert into profiles default values returning id")).rows[0].id;
await db.query("insert into player_profiles values ($1)", [late]);
assert.equal((await db.query("select claim_event_gifts($1) as n", [late])).rows[0].n, 0);
assert.equal(await inventory(late), 0);

// Spesialkortet: både inform og honorable forekommer, og begge scope virker som før.
const kinds = new Set();
for (let run = 0; run < 100; run += 1) kinds.add((await db.query("select draw_special_card('mix', '{}') as id")).rows[0].id);
assert.equal(kinds.size, 2, "mix trekker både inform og honorable");
const informOnly = (await db.query("select draw_special_card('informs', '{}') as id")).rows[0].id;
assert.equal((await db.query("select kind from special_cards where id = $1", [informOnly])).rows[0].kind, "inform");
// Er den ene typen utelukket, brukes den andre.
const [informId] = (await db.query("select id from special_cards where kind = 'inform'")).rows.map((row) => row.id);
for (let run = 0; run < 20; run += 1) {
  const id = (await db.query("select draw_special_card('mix', $1::uuid[]) as id", [[informId]])).rows[0].id;
  assert.notEqual(id, informId);
}

// Spillervalget: fem ulike spillere på 83+, uten dem manageren allerede har.
await db.query("insert into manager_cards (owner_id, catalog_id, name, position, overall, location) select $1, id, name, position, overall, 'squad' from player_catalog where slug in ('p20', 'p21')", [user]);
for (let run = 0; run < 100; run += 1) {
  const id = (await db.query("select create_player_pick($1, 83, 5) as id", [user])).rows[0].id;
  const row = (await db.query("select options from player_picks where id = $1", [id])).rows[0];
  const players = (await db.query("select slug, overall from player_catalog where id = any($1::uuid[])", [row.options])).rows;
  assert.equal(players.length, 5, "fem spillere");
  assert.equal(new Set(row.options).size, 5, "fem ulike spillere");
  assert.ok(players.every((player) => player.overall >= 83), "alle 83+");
  assert.ok(players.every((player) => !["p20", "p21"].includes(player.slug)), "ingen som manageren allerede har");
}

// Valget: kortet havner i klubben som vanlig kort, og valget kan bare brukes én gang.
const pick = (await db.query("select id, options from player_picks where user_id = $1 limit 1", [user])).rows[0];
const result = (await db.query("select claim_player_pick($1, $2, $3) as r", [user, pick.id, pick.options[0]])).rows[0].r;
assert.equal(result.location, "squad"); assert.equal(result.special, null); assert.ok(result.overall >= 83);
const added = (await db.query("select special_card_id, catalog_id from manager_cards where id = $1", [result.card_id])).rows[0];
assert.equal(added.special_card_id, null); assert.equal(added.catalog_id, pick.options[0]);
await assert.rejects(db.query("select claim_player_pick($1, $2, $3)", [user, pick.id, pick.options[1]]), /allerede/);
const other = (await db.query("select id, options from player_picks where user_id = $1 and chosen_at is null limit 1", [user])).rows[0];
await assert.rejects(db.query("select claim_player_pick($1, $2, $3)", [user, other.id, "00000000-0000-0000-0000-000000000000"]), /ikke blant de fem/);
await assert.rejects(db.query("select claim_player_pick($1, $2, $3)", [late, other.id, other.options[0]]), /Fant ikke spillervalget/);

// Åpne pakken: inventaret går ned, spesialkortet kommer, og spillervalget lages.
await db.query("delete from player_picks");
await db.query("select grant_pack($1, 'brodrestevnet_brooor', 1)", [late]);
const pulls = (await db.query("select open_free_manager_pack($1, 'brodrestevnet_brooor') as r", [late])).rows[0].r;
assert.equal(pulls.length, 1); assert.ok(["inform", "honorable"].includes(pulls[0].special));
assert.equal(await inventory(late), 0);
assert.equal((await db.query("select count(*)::int as n from player_picks where user_id = $1 and chosen_at is null", [late])).rows[0].n, 1);
await assert.rejects(db.query("select open_free_manager_pack($1, 'brodrestevnet_brooor')", [late]), /ingen gratis pakker/);
// Andre pakker lager ikke spillervalg.
await db.query("insert into manager_packs (key, name, description, price, card_count, guarantee_min, guarantee_count, guarantees, odds, accent, sort_order, special_guarantee, special_scope, purchasable, active) values ('annen', 'a', 'b', 1, 1, 50, 1, '[]', '[]', '#fff', 1, 1, 'current', false, true)");
await db.query("select grant_pack($1, 'annen', 1)", [late]);
await db.query("select open_free_manager_pack($1, 'annen')", [late]);
assert.equal((await db.query("select count(*)::int as n from player_picks where user_id = $1 and chosen_at is null", [late])).rows[0].n, 1);

// 0115: alle med managerprofil får pakken én gang. De som har fått den, får ingen ny.
const claimed = (await db.query("insert into profiles default values returning id")).rows[0].id;
const fresh = (await db.query("insert into profiles default values returning id")).rows[0].id;
await db.query("insert into player_profiles values ($1), ($2)", [claimed, fresh]);
await db.query("insert into event_gift_claims (user_id, gift_key) values ($1, 'brodrestevnet_brooor')", [claimed]);
await db.query("select grant_pack($1, 'brodrestevnet_brooor', 1)", [claimed]);
const bulk = readFileSync(new URL("../supabase/migrations/0115_brodrestevnet_til_alle.sql", import.meta.url), "utf8");
await db.exec(bulk);
assert.equal(await inventory(fresh), 1, "ny manager får pakken");
assert.equal(await inventory(claimed), 1, "ingen ny pakke til den som hadde fått den");
assert.equal(await inventory(noProfile), 0, "uten managerprofil: ingen pakke");
await db.exec(bulk);
assert.equal(await inventory(fresh), 1, "kjøres den to ganger, gir den ikke dobbelt");

console.log("Brødrestevnet brooor: alt OK");
