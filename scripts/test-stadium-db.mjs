// Tester databasefunksjonene i migrering 0123 (stadion) mot en PGlite-database med forenklede tabeller.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table profiles (id uuid primary key default gen_random_uuid());
create table player_profiles (user_id uuid primary key references profiles(id), manager_budget integer not null default 0 check (manager_budget >= 0), manager_budget_earned integer not null default 0, updated_at timestamptz);
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0123_stadion.sql", import.meta.url), "utf8"));

const user = async (budget) => {
  const { rows: [{ id }] } = await db.query("insert into profiles default values returning id");
  await db.query("insert into player_profiles (user_id, manager_budget) values ($1, $2)", [id, budget]);
  return id;
};
const upgrade = async (id, building, level, cost = 10, seconds = 600, builders = 1, minKlubbhus = 1) =>
  (await db.query("select stadium_start_upgrade($1, $2, $3, $4, $5, $6, $7) as r", [id, building, level, cost, seconds, builders, minKlubbhus])).rows[0].r;
const budget = async (id) => (await db.query("select manager_budget as b, manager_budget_earned as e from player_profiles where user_id = $1", [id])).rows[0];
const collect = async (id, rate, capacity) => (await db.query("select stadium_collect($1, $2, $3) as r", [id, rate, capacity])).rows[0].r;

// Vellykket oppgradering trekker pengene og setter byggetiden.
const a = await user(100);
const first = await upgrade(a, "tribune", 1, 60, 900);
assert.equal(first.ok, true);
assert.equal((await budget(a)).b, 40);
const { rows: [row] } = await db.query("select level, upgrade_to, upgrade_ends_at > now() as running from stadium_buildings where user_id = $1 and building = 'tribune'", [a]);
assert.deepEqual([row.level, row.upgrade_to, row.running], [0, 1, true]);

// Én byggher: en annen bygning må vente, og samme bygning er opptatt. Ingenting trekkes.
assert.equal((await upgrade(a, "billettluke", 2, 40, 600)).reason, "builders_busy");
assert.equal((await upgrade(a, "tribune", 1, 60, 900)).reason, "busy");
assert.equal((await budget(a)).b, 40);
// To byggere gir plass til to.
assert.equal((await upgrade(a, "billettluke", 2, 40, 600, 2)).ok, true);
assert.equal((await budget(a)).b, 0);

// For lite penger.
const b = await user(30);
assert.equal((await upgrade(b, "tribune", 1, 60, 900)).reason, "no_money");
assert.equal((await budget(b)).b, 30);
assert.equal((await db.query("select count(*)::int as n from stadium_buildings where user_id = $1", [b])).rows[0].n, 0);

// Klubbhuset må være høyt nok.
assert.equal((await upgrade(b, "billettluke", 3, 5, 600, 1, 2)).reason, "klubbhus_low");

// Ferdig oppgradering blir utført, og byggeren er ledig. Nivåene må tas i rekkefølge.
const c = await user(1000);
assert.equal((await upgrade(c, "billettluke", 2, 10, 600)).ok, true);
assert.equal((await upgrade(c, "billettluke", 3, 10, 600)).reason, "busy");
await db.query("update stadium_buildings set upgrade_ends_at = now() - interval '1 second' where user_id = $1", [c]);
assert.equal((await upgrade(c, "billettluke", 4, 10, 600)).reason, "stale");
assert.equal((await upgrade(c, "billettluke", 3, 10, 600)).ok, true);
const { rows: [done] } = await db.query("select level, upgrade_to from stadium_buildings where user_id = $1 and building = 'billettluke'", [c]);
assert.deepEqual([done.level, done.upgrade_to], [2, 3]);
// Klubbhuset kan oppgraderes fra startnivå 1 til 2 uten rad fra før.
const d = await user(1000);
assert.equal((await upgrade(d, "klubbhus", 2, 300, 14400)).ok, true);
assert.equal((await db.query("select level from stadium_buildings where user_id = $1 and building = 'klubbhus'", [d])).rows[0].level, 1);
// Klubbhus 1 etter ferdig oppgradering til 2 oppfyller kravet om klubbhus 2.
await db.query("update stadium_buildings set upgrade_ends_at = now() - interval '1 second' where user_id = $1", [d]);
assert.equal((await upgrade(d, "billettluke", 3, 5, 600, 1, 2)).ok, true);

// Ugyldige verdier.
assert.equal((await upgrade(d, "stall", 1)).reason, "invalid");
assert.equal((await upgrade(d, "tribune", 0)).reason, "invalid");
assert.equal((await upgrade(d, "tribune", 1, -5)).reason, "invalid");
assert.equal((await upgrade("00000000-0000-0000-0000-000000000000", "tribune", 1)).reason, "no_profile");

// Billettluka: 1 MB i timen, 8 timer lager. Nylig tømt gir ingenting.
const e = await user(0);
assert.equal((await collect(e, 1, 8)).reason, "nothing");
await db.query("update player_profiles set stadium_collected_at = now() - interval '3 hours 30 minutes' where user_id = $1", [e]);
assert.deepEqual(await collect(e, 1, 8), { ok: true, amount: 3 });
assert.deepEqual(await budget(e), { b: 3, e: 3 });
// Klokka er nullstilt, så en ny tømming rett etterpå gir ingenting.
assert.equal((await collect(e, 1, 8)).reason, "nothing");
// Kapasiteten er taket, også etter lang tid.
await db.query("update player_profiles set stadium_collected_at = now() - interval '30 days' where user_id = $1", [e]);
assert.deepEqual(await collect(e, 12, 96), { ok: true, amount: 96 });
assert.equal((await budget(e)).b, 99);
assert.equal((await collect(e, -1, 8)).reason, "invalid");

console.log("Stadion-databasen: alle sjekker bestått.");
