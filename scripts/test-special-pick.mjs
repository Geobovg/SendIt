// Tester spillervalget (migrering 0102) mot en PGlite-database med forenklede tabeller.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table profiles (id uuid primary key default gen_random_uuid());
create table player_profiles (user_id uuid primary key references profiles(id));
create table player_catalog (id uuid primary key default gen_random_uuid(), slug text, name text, position text, overall int, price int, accent text, club text, attributes jsonb default '{}');
create table special_cards (id uuid primary key default gen_random_uuid(), kind text, catalog_id uuid references player_catalog(id), overall int, price int, attributes jsonb);
create table manager_cards (id uuid primary key default gen_random_uuid(), owner_id uuid, catalog_id uuid, name text, position text, overall int, attributes jsonb, acquired_price int, location text, special_card_id uuid, tradable boolean);
create function manager_squad_capacity() returns integer language sql as $$ select 23 $$;
-- Forenklet trekning: tilfeldig kort av riktig type som ikke er utelukket.
create function draw_special_card(scope text, excluded uuid[]) returns uuid language sql volatile as $$
  select id from special_cards where kind = case scope when 'honorable' then 'honorable' else 'inform' end and id <> all(coalesce(excluded, '{}')) order by random() limit 1 $$;
`);
// 30 spillere: 20 har inform fra to uker (to kort hver), 10 har honorable mention, og tre har begge deler.
await db.exec(`
insert into player_catalog (slug, name, position, overall, price, accent, club)
select 'p' || n, 'Spiller ' || n, 'CM', 70, 1000, '#35d06a', 'Klubb' from generate_series(1, 30) n;
insert into special_cards (kind, catalog_id, overall, price) select 'inform', id, 85, 5000 from player_catalog where slug in (select 'p' || n from generate_series(1, 20) n);
insert into special_cards (kind, catalog_id, overall, price) select 'inform', id, 87, 6000 from player_catalog where slug in (select 'p' || n from generate_series(1, 20) n);
insert into special_cards (kind, catalog_id, overall, price) select 'honorable', id, 88, 4000 from player_catalog where slug in (select 'p' || n from generate_series(18, 30) n);
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0102_spillervalg.sql", import.meta.url), "utf8").replace(/-- Gi alle[\s\S]*$/, ""));

const user = (await db.query("insert into profiles default values returning id")).rows[0].id;
await db.query("insert into player_profiles values ($1)", [user]);

const honorableCounts = new Set();
for (let run = 0; run < 200; run += 1) {
  const id = (await db.query("select create_special_pick($1) as id", [user])).rows[0].id;
  const row = (await db.query("select options from special_picks where id = $1", [id])).rows[0];
  const cards = (await db.query("select kind, catalog_id from special_cards where id = any($1::uuid[])", [row.options])).rows;
  assert.equal(cards.length, 5, "fem kort");
  assert.equal(new Set(cards.map((card) => card.catalog_id)).size, 5, "fem ulike spillere");
  honorableCounts.add(cards.filter((card) => card.kind === "honorable").length);
}
assert.ok(honorableCounts.size >= 4, `antall honorable varierer (${[...honorableCounts].sort()})`);

// Velge ett kort: kortet havner i klubben, og valget kan ikke brukes igjen.
const pick = (await db.query("select id, options from special_picks where user_id = $1 limit 1", [user])).rows[0];
const result = (await db.query("select claim_special_pick($1, $2, $3) as r", [user, pick.id, pick.options[0]])).rows[0].r;
assert.equal(result.location, "squad");
assert.ok(result.special === "inform" || result.special === "honorable");
assert.equal((await db.query("select count(*)::int as n from manager_cards where owner_id = $1", [user])).rows[0].n, 1);
await assert.rejects(db.query("select claim_special_pick($1, $2, $3)", [user, pick.id, pick.options[1]]), /allerede/);
const other = (await db.query("select id, options from special_picks where user_id = $1 and chosen_at is null limit 1", [user])).rows[0];
const outside = (await db.query("select id from special_cards where id <> all($1::uuid[]) limit 1", [other.options])).rows[0].id;
await assert.rejects(db.query("select claim_special_pick($1, $2, $3)", [user, other.id, outside]), /ikke blant/);
const stranger = (await db.query("insert into profiles default values returning id")).rows[0].id;
await db.query("insert into player_profiles values ($1)", [stranger]);
await assert.rejects(db.query("select claim_special_pick($1, $2, $3)", [stranger, other.id, other.options[0]]), /Fant ikke spillervalget/);
assert.equal((await db.query("select count(*)::int as n from manager_cards where owner_id = $1", [user])).rows[0].n, 1);

// Full tropp: kortet går til lageret.
await db.query("insert into manager_cards (owner_id, location) select $1, 'squad' from generate_series(1, 22)", [user]);
const full = (await db.query("select claim_special_pick($1, $2, $3) as r", [user, other.id, other.options[0]])).rows[0].r;
assert.equal(full.location, "storage");
console.log("Special pick passed: 200 draws with five different players, random mix of types, single claim, ownership checks and full squad.");
