// Tester migrering 0124 (Inner Peace i alle pakker) mot en PGlite-database med forenklede tabeller:
// migreringen lar seg kjøre, sjansene står riktig, og scopet 'elite' gir bare spesialkort på 88+.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table game_settings (key text primary key, value jsonb);
create table special_rounds (id uuid primary key default gen_random_uuid(), kind text, starts_at timestamptz default now(), ends_at timestamptz);
create table special_cards (id uuid primary key default gen_random_uuid(), round_id uuid, kind text not null, catalog_id uuid, overall int not null);
create table player_profiles (user_id uuid primary key);
create function ensure_special_round() returns uuid language sql as $$ select null::uuid $$;
create table manager_packs (key text primary key, description text, icon_chance numeric not null default 0, inform_max_overall int,
  special_scope text not null default 'current' check (special_scope in ('current', 'all', 'tots', 'mix', 'inner_peace')));
insert into manager_packs (key, special_scope) values ('gullpakke', 'current'), ('gull_spillere', 'current'), ('premium_gull', 'current'), ('sjeldne_spillere', 'current'),
  ('jumbo_premium_gull', 'current'), ('stjerneutvalg', 'current'), ('formpakka', 'mix'), ('skadoosh_dude', 'current'), ('kachow_pal', 'inner_peace');
insert into special_cards (kind, overall)
  select 'inner_peace', 88 + (n % 8) from generate_series(1, 34) n
  union all select 'honorable', 85 + (n % 6) from generate_series(1, 20) n
  union all select 'inform', 82 + (n % 9) from generate_series(1, 23) n;
`);

// draw_special_card slik den er etter 0114 (omdøpt til _base), så 0124 bygger på samme kjede som i produksjon.
const honorable = readFileSync("supabase/migrations/0088_honorable_mention.sql", "utf8").split("\n").slice(72, 138).join("\n");
await db.exec(honorable.replace("public.draw_special_card(scope text", "public.draw_special_card_base(scope text").replaceAll("public.draw_special_card(", "public.draw_special_card_base("));
await db.exec(readFileSync("supabase/migrations/0124_inner_peace_i_alle_pakker.sql", "utf8"));

const packs = Object.fromEntries((await db.query("select key, inner_peace_chance::float8 as ip, icon_chance::float8 as icon, special_scope from manager_packs")).rows.map((row) => [row.key, row]));
assert.equal(packs.kachow_pal.special_scope, "elite");
for (const [key, ip] of Object.entries({ gullpakke: 0.0003, gull_spillere: 0.0005, premium_gull: 0.0008, sjeldne_spillere: 0.002, jumbo_premium_gull: 0.003, stjerneutvalg: 0.005, formpakka: 0.008, skadoosh_dude: 0.006, kachow_pal: 0.015 })) {
  assert.equal(packs[key].ip, ip, key);
}
// Sjansen for Inner Peace stiger med prisen, og Kachow pal er høyest.
const order = ["gullpakke", "gull_spillere", "premium_gull", "sjeldne_spillere", "jumbo_premium_gull", "stjerneutvalg", "formpakka"];
for (let index = 1; index < order.length; index += 1) assert.ok(packs[order[index]].ip > packs[order[index - 1]].ip, order[index]);
assert.ok(Object.entries(packs).every(([key, pack]) => key === "kachow_pal" || pack.ip < packs.kachow_pal.ip));
assert.equal(packs.stjerneutvalg.icon, 0.0012);
assert.equal(packs.formpakka.icon, 0.002);

// Scopet 'elite': alltid 88+, og alle tre typene kommer.
const counts = { inner_peace: 0, honorable: 0, inform: 0 };
const draws = 6000;
for (let index = 0; index < draws; index += 1) {
  const { rows } = await db.query("select kind, overall from special_cards where id = (select draw_special_card('elite', '{}'))");
  assert.equal(rows.length, 1);
  assert.ok(rows[0].overall >= 88, `rating ${rows[0].overall}`);
  counts[rows[0].kind] += 1;
}
const share = (kind) => counts[kind] / draws;
assert.ok(Math.abs(share("inner_peace") - 0.35) < 0.04, `inner_peace ${share("inner_peace")}`);
assert.ok(Math.abs(share("honorable") - 0.35) < 0.04, `honorable ${share("honorable")}`);
assert.ok(Math.abs(share("inform") - 0.3) < 0.04, `inform ${share("inform")}`);

// Er alle Inner Peace-kortene allerede trukket, faller 'elite' tilbake på de andre typene, og mangler alt på 88+, gir det null.
const used = (await db.query("select array_agg(id) as ids from special_cards where kind = 'inner_peace'")).rows[0].ids;
for (let index = 0; index < 200; index += 1) {
  const { rows } = await db.query("select kind from special_cards where id = (select draw_special_card('elite', $1::uuid[]))", [used]);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].kind, "inner_peace");
}
const all = (await db.query("select array_agg(id) as ids from special_cards where overall >= 88")).rows[0].ids;
assert.equal((await db.query("select draw_special_card('elite', $1::uuid[]) as id", [all])).rows[0].id, null);

// De andre scopene virker som før.
assert.equal((await db.query("select kind from special_cards where id = (select draw_special_card('inner_peace', '{}'))")).rows[0].kind, "inner_peace");
assert.equal((await db.query("select kind from special_cards where id = (select draw_special_card('honorable', '{}'))")).rows[0].kind, "honorable");
console.log("OK: Inner Peace i alle pakker");
