import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

export async function createDraftTestDb(withRewards = false) {
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table profiles (id uuid primary key default gen_random_uuid(), username text);
create table player_profiles (user_id uuid primary key references profiles(id), manager_budget integer not null default 0, manager_budget_earned integer not null default 0, updated_at timestamptz);
create table career_challenges (id uuid primary key default gen_random_uuid(), status text);
create table career_matches (
  id uuid primary key default gen_random_uuid(), challenge_id uuid, mode text not null, home_user_id uuid not null references profiles(id), away_user_id uuid references profiles(id), away_ai_name text,
  status text not null default 'lobby', home_score int default 0, away_score int default 0, winner_id uuid, home_penalties int, away_penalties int,
  events jsonb not null default '[]', started_at timestamptz, completed_at timestamptz);
create table career_match_shots (match_id uuid, minute int, side text, outcome text);
create table career_reward_events (id uuid primary key default gen_random_uuid(), user_id uuid, source_type text, source_id uuid, reward_key text, manager_budget int, club_xp int, unique (user_id, source_type, source_id, reward_key), constraint career_reward_events_source_type_check check (source_type in ('career_match')));
create table manager_pack_inventory (user_id uuid, pack_key text, quantity int, updated_at timestamptz, primary key (user_id, pack_key));
create table awards (user_id uuid, key text);
create function award_manager_match_result(u uuid, m uuid, k text, b int, c text) returns boolean language sql as $$ insert into awards values (u, k); select true $$;
create function record_season_match_result(m uuid, h int, a int) returns void language sql as $$ select $$;
create function grant_pack(target_user uuid, target_pack text, amount integer) returns void language sql as $$
  insert into manager_pack_inventory (user_id, pack_key, quantity) select target_user, target_pack, amount where amount > 0
  on conflict (user_id, pack_key) do update set quantity = manager_pack_inventory.quantity + excluded.quantity $$;
create function simulate_ai_goals(own_rating integer, other_rating integer) returns integer language sql volatile as $$
  select least(6, greatest(0, floor(random() * 3.2 + (own_rating - other_rating) / 8.0 + random() * 0.8)::integer)) $$;
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0095_draft.sql", import.meta.url), "utf8"));
await db.exec(`
create table manager_packs (
  key text primary key, name text, description text, price integer not null,
  card_count integer default 3, guarantee_min integer default 0, guarantee_count integer default 0,
  guarantees jsonb default '[]', odds jsonb default '[]', accent text, sort_order integer,
  inform_chance numeric default 0, tots_chance numeric default 0, icon_chance numeric default 0,
  honorable_chance numeric default 0, special_guarantee integer default 0,
  special_scope text default 'current', purchasable boolean default true, active boolean default true
);
insert into manager_packs(key,name,price) values
('gullpakke','Gullpakke',40),('gull_spillere','Gull spillerpakke',75),('premium_gull','Premium gullpakke',100),
('sjeldne_spillere','Sjeldne spillere',200),('jumbo_premium_gull','Jumbo premium gull',300);
`);
if (withRewards) await db.exec(readFileSync(new URL("../supabase/migrations/0096_draft_premier.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../supabase/migrations/0103_draft_innsats_150.sql", import.meta.url), "utf8"));
return db;
}
