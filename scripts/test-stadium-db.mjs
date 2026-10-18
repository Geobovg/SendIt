// Tester databasefunksjonene i migrering 0123 (stadion) mot en PGlite-database med forenklede tabeller.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table profiles (id uuid primary key default gen_random_uuid());
create table player_profiles (user_id uuid primary key references profiles(id), manager_budget integer not null default 0 check (manager_budget >= 0), manager_budget_earned integer not null default 0, club_xp integer not null default 0, updated_at timestamptz);
create table player_catalog (id uuid primary key default gen_random_uuid(), slug text, name text, position text, overall int, price int, accent text default '#fff', club text default 'FC Test', attributes jsonb default '{}', active boolean default true);
create table manager_cards (id uuid primary key default gen_random_uuid(), owner_id uuid, catalog_id uuid, special_card_id uuid, name text, position text, overall int, attributes jsonb, acquired_price int, location text);
create table manager_pack_inventory (user_id uuid not null, pack_key text not null, quantity int not null default 0, primary key (user_id, pack_key));
create function grant_pack(target_user uuid, target_pack text, amount integer) returns void language sql as $$
  insert into manager_pack_inventory (user_id, pack_key, quantity) select target_user, target_pack, amount where amount > 0
  on conflict (user_id, pack_key) do update set quantity = manager_pack_inventory.quantity + excluded.quantity $$;
create function grant_club_xp(target_user uuid, amount integer) returns integer language plpgsql as $$
  begin update player_profiles set club_xp = club_xp + amount where user_id = target_user; return 1; end $$;
-- Troppen og lageret rommer tre kort i testen.
create function next_card_location(target_user uuid) returns text language sql as $$
  select case when (select count(*) from manager_cards where owner_id = target_user) >= 3 then null else 'squad' end $$;
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0123_stadion.sql", import.meta.url), "utf8"));

const user = async (budget) => {
  const { rows: [{ id }] } = await db.query("insert into profiles default values returning id");
  await db.query("insert into player_profiles (user_id, manager_budget) values ($1, $2)", [id, budget]);
  return id;
};
const rpc = async (name, ...args) => (await db.query(`select ${name}(${args.map((_, index) => `$${index + 1}`).join(", ")}) as r`, args)).rows[0].r;
const upgrade = (id, building, level, cost = 10, seconds = 600, builders = 1, minKlubbhus = 1) => rpc("stadium_start_upgrade", id, building, level, cost, seconds, builders, minKlubbhus);
const speedup = (id, building, perHour = 20, free = 300) => rpc("stadium_speedup", id, building, perHour, free);
const collect = (id, collector, rate, capacity) => rpc("stadium_collect", id, collector, rate, capacity);
const profile = async (id) => (await db.query("select manager_budget as b, manager_budget_earned as e, club_xp as xp from player_profiles where user_id = $1", [id])).rows[0];
const building = async (id, name) => (await db.query("select level, upgrade_to, upgrade_ends_at from stadium_buildings where user_id = $1 and building = $2", [id, name])).rows[0];

// --- Oppgraderinger ---
// Vellykket oppgradering trekker pengene og setter byggetiden.
const a = await user(100);
assert.equal((await upgrade(a, "tribune", 1, 60, 900)).ok, true);
assert.equal((await profile(a)).b, 40);
const first = await building(a, "tribune");
assert.deepEqual([first.level, first.upgrade_to], [0, 1]);

// Én byggher: en annen bygning må vente, og samme bygning er opptatt. Ingenting trekkes.
assert.equal((await upgrade(a, "billettluke", 2, 40, 600)).reason, "builders_busy");
assert.equal((await upgrade(a, "tribune", 1, 60, 900)).reason, "busy");
assert.equal((await profile(a)).b, 40);
// To byggere gir plass til to.
assert.equal((await upgrade(a, "billettluke", 2, 40, 600, 2)).ok, true);
assert.equal((await profile(a)).b, 0);

// For lite penger.
const b = await user(30);
assert.equal((await upgrade(b, "tribune", 1, 60, 900)).reason, "no_money");
assert.equal((await profile(b)).b, 30);
assert.equal((await db.query("select count(*)::int as n from stadium_buildings where user_id = $1", [b])).rows[0].n, 0);
// Klubbhuset må være høyt nok.
assert.equal((await upgrade(b, "billettluke", 3, 5, 600, 1, 2)).reason, "klubbhus_low");

// Ferdig oppgradering blir utført, og byggeren er ledig. Nivåene må tas i rekkefølge.
const c = await user(1000);
assert.equal((await upgrade(c, "billettluke", 2, 10, 600)).ok, true);
assert.equal((await upgrade(c, "billettluke", 3, 10, 600)).reason, "busy");
await db.query("update stadium_buildings set upgrade_started_at = now() - interval '11 minutes', upgrade_ends_at = now() - interval '1 second' where user_id = $1", [c]);
assert.equal((await upgrade(c, "billettluke", 4, 10, 600)).reason, "stale");
assert.equal((await upgrade(c, "billettluke", 3, 10, 600)).ok, true);
const done = await building(c, "billettluke");
assert.deepEqual([done.level, done.upgrade_to], [2, 3]);

// Klubbhuset kan oppgraderes fra startnivå 1 til 2 uten rad fra før, og oppfyller så kravet om klubbhus 2.
const d = await user(1000);
assert.equal((await upgrade(d, "klubbhus", 2, 300, 14400)).ok, true);
assert.equal((await building(d, "klubbhus")).level, 1);
await db.query("update stadium_buildings set upgrade_started_at = now() - interval '5 hours', upgrade_ends_at = now() - interval '1 second' where user_id = $1", [d]);
assert.equal((await upgrade(d, "billettluke", 3, 5, 600, 1, 2)).ok, true);

// Ugyldige verdier.
assert.equal((await upgrade(d, "stall", 1)).reason, "invalid");
assert.equal((await upgrade(d, "tribune", 0)).reason, "invalid");
assert.equal((await upgrade(d, "tribune", 11)).reason, "invalid");
assert.equal((await upgrade(d, "tribune", 1, -5)).reason, "invalid");
assert.equal((await upgrade("00000000-0000-0000-0000-000000000000", "tribune", 1)).reason, "no_profile");

// --- Hurtigbygging ---
// 1 time igjen koster 20 MB, og bygningen er ferdig med en gang.
const e = await user(100);
assert.equal((await upgrade(e, "supporterfelt", 1, 10, 3600)).ok, true);
const quick = await speedup(e, "supporterfelt");
assert.equal(quick.ok, true);
assert.ok(quick.cost >= 19 && quick.cost <= 20, `pris ${quick.cost}`);
assert.equal((await profile(e)).b, 90 - quick.cost);
const finished = await building(e, "supporterfelt");
assert.deepEqual([finished.level, finished.upgrade_to, finished.upgrade_ends_at], [1, null, null]);
// Ingenting å skynde på, og byggeren er ledig igjen.
assert.equal((await speedup(e, "supporterfelt")).reason, "not_building");
assert.equal((await upgrade(e, "tribune", 1, 5, 600)).ok, true);
// De siste minuttene er gratis.
assert.equal((await upgrade(e, "kasse", 2, 0, 200, 2)).ok, true);
const before = (await profile(e)).b;
assert.deepEqual(await speedup(e, "kasse"), { ok: true, cost: 0 });
assert.equal((await profile(e)).b, before);
assert.equal((await building(e, "kasse")).level, 2);
// For lite penger: ingenting skjer.
const f = await user(30);
assert.equal((await upgrade(f, "tribune", 1, 0, 86400)).ok, true);
assert.equal((await speedup(f, "tribune")).reason, "no_money");
assert.equal((await building(f, "tribune")).upgrade_to, 1);
assert.equal((await profile(f)).b, 30);
assert.equal((await speedup(f, "tribune", -1)).reason, "invalid");

// --- Treningsfeltet ---
// XP-klokka starter når treningsfeltet står ferdig, ikke fra migreringen.
const g = await user(500);
assert.equal((await upgrade(g, "treningsfelt", 1, 80, 1200)).ok, true);
assert.equal((await db.query("select stadium_xp_collected_at > now() + interval '19 minutes' as later from player_profiles where user_id = $1", [g])).rows[0].later, true);
// Hurtigbygger man det, starter klokka nå.
assert.equal((await speedup(g, "treningsfelt")).ok, true);
assert.equal((await db.query("select stadium_xp_collected_at <= now() as started from player_profiles where user_id = $1", [g])).rows[0].started, true);

// --- Samling ---
// Billettluka: 1 MB i timen. Nylig tømt gir ingenting.
const h = await user(0);
assert.equal((await collect(h, "mb", 1, 8)).reason, "nothing");
await db.query("update player_profiles set stadium_collected_at = now() - interval '3 hours 30 minutes' where user_id = $1", [h]);
assert.deepEqual(await collect(h, "mb", 1, 8), { ok: true, amount: 3 });
assert.deepEqual(await profile(h), { b: 3, e: 3, xp: 0 });
// Klokka er nullstilt, så en ny tømming rett etterpå gir ingenting.
assert.equal((await collect(h, "mb", 1, 8)).reason, "nothing");
// Kapasiteten er taket, også etter lang tid.
await db.query("update player_profiles set stadium_collected_at = now() - interval '30 days' where user_id = $1", [h]);
assert.deepEqual(await collect(h, "mb", 12, 96), { ok: true, amount: 96 });
assert.equal((await profile(h)).b, 99);
assert.equal((await collect(h, "mb", -1, 8)).reason, "invalid");
assert.equal((await collect(h, "gull", 1, 8)).reason, "invalid");
// Treningsfeltet: XP går til klubbnivået, ikke til budsjettet, og har egen klokke.
await db.query("update player_profiles set stadium_xp_collected_at = now() - interval '3 hours' where user_id = $1", [h]);
assert.deepEqual(await collect(h, "xp", 2, 100), { ok: true, amount: 6 });
assert.deepEqual(await profile(h), { b: 99, e: 99, xp: 6 });
assert.equal((await collect(h, "xp", 2, 100)).reason, "nothing");

// --- Speideren ---
for (const [overall, name, price] of [[87, "A", 280], [88, "B", 400], [88, "C", 400], [90, "Utenfor", 800]]) await db.query("insert into player_catalog (slug, name, position, overall, price) values ($1, $2, 'ST', $3, $4)", [name.toLowerCase(), name, overall, price]);
const scout = (id) => rpc("stadium_scout_send", id, 3, 86400);
const reveal = (id, min = 87, max = 88) => rpc("stadium_scout_reveal", id, min, max, "sjeldne_spillere", 0.6);
const choose = (id, choice) => rpc("stadium_scout_choose", id, choice);
const backdate = (id) => db.query("update stadium_scouts set started_at = now() - interval '25 hours', ends_at = now() - interval '1 hour' where user_id = $1", [id]);

const s = await user(1000);
assert.equal((await reveal(s)).reason, "no_scout");
assert.equal((await scout(s)).ok, true);
assert.equal((await scout(s)).reason, "scout_busy");
assert.equal((await reveal(s)).reason, "scout_away");
assert.equal((await choose(s, "pack")).reason, "no_offer");
await backdate(s);
// Forslaget velges én gang og står fast. Spilleren er innenfor ratingen, og prisen er 60 % av katalogprisen.
const opened = await reveal(s);
assert.equal(opened.ok, true);
assert.equal(opened.offer.pack_key, "sjeldne_spillere");
assert.ok(["A", "B", "C"].includes(opened.offer.player.name), `uventet spiller ${opened.offer.player.name}`);
assert.equal(opened.offer.player.price, Math.round((opened.offer.player.overall === 87 ? 280 : 400) * 0.6));
assert.deepEqual(await reveal(s), opened);
assert.equal((await scout(s)).reason, "scout_busy");
// Kjøper spilleren: pengene trekkes, kortet havner i troppen, og oppdraget er over.
const bought = await choose(s, "player");
assert.equal(bought.ok, true);
assert.equal(bought.kind, "player");
assert.equal((await profile(s)).b, 1000 - opened.offer.player.price);
const { rows: [card] } = await db.query("select name, owner_id, location, acquired_price from manager_cards where id = $1", [bought.card_id]);
assert.deepEqual([card.name, card.owner_id, card.location], [opened.offer.player.name, s, "squad"]);
assert.equal((await choose(s, "player")).reason, "no_offer");
assert.equal((await db.query("select count(*)::int as n from stadium_scouts where user_id = $1", [s])).rows[0].n, 0);

// Velger pakka: den havner i gratispakkene, og ingenting trekkes.
const t = await user(50);
await scout(t); await backdate(t); await reveal(t);
assert.deepEqual(await choose(t, "pack"), { ok: true, kind: "pack", pack_key: "sjeldne_spillere" });
assert.equal((await db.query("select quantity from manager_pack_inventory where user_id = $1 and pack_key = 'sjeldne_spillere'", [t])).rows[0].quantity, 1);
assert.equal((await profile(t)).b, 50);
assert.equal((await choose(t, "pack")).reason, "no_offer");
// Kan sende ut en ny speider etter at forrige er behandlet.
assert.equal((await scout(t)).ok, true);

// For lite penger til spilleren: forslaget står, og pakka kan fortsatt velges.
const u = await user(10);
await scout(u); await backdate(u); await reveal(u);
assert.equal((await choose(u, "player")).reason, "no_money");
assert.equal((await choose(u, "pack")).ok, true);

// Eier du alle som passer, er det bare pakka. Spilleren eies ikke fra før hvis kortet er et spesialkort.
const v = await user(1000);
await db.query("insert into manager_cards (owner_id, catalog_id, name) select $1, id, name from player_catalog where overall between 87 and 88", [v]);
await scout(v); await backdate(v);
const noPlayer = await reveal(v);
assert.deepEqual([noPlayer.ok, noPlayer.offer.player, noPlayer.offer.pack_key], [true, null, "sjeldne_spillere"]);
assert.equal((await choose(v, "player")).reason, "no_offer");
assert.equal((await choose(v, "pack")).ok, true);

// Troppen og lageret er fullt.
const w = await user(1000);
await db.query("insert into manager_cards (owner_id, name) select $1, 'Fyll' from generate_series(1, 3)", [w]);
await scout(w); await backdate(w); await reveal(w, 87, 88);
assert.equal((await choose(w, "player")).reason, "no_room");
assert.equal((await choose(w, "pack")).ok, true);

// Ugyldige verdier.
assert.equal((await rpc("stadium_scout_send", w, 0, 100)).reason, "invalid");
assert.equal((await rpc("stadium_scout_send", w, 11, 100)).reason, "invalid");
assert.equal((await rpc("stadium_scout_send", w, 3, 0)).reason, "invalid");
assert.equal((await rpc("stadium_scout_reveal", w, 90, 88, "x", 0.6)).reason, "invalid");
assert.equal((await choose(w, "kort")).reason, "invalid");

console.log("Stadion-databasen: alle sjekker bestått.");
