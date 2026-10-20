-- Univers: man kan fortsatt spille i et universe man har forlatt (se docs/adr/0005-univers.md).
-- * Hvert univers har sitt eget lag, kort, MB, pakker og stadion. Det som er i spill akkurat nå er de levende radene.
--   Når du bytter univers, lagres de levende radene som JSON i universe_saves, og det andre universets rader hentes inn igjen.
--   All eksisterende kode virker derfor uendret i begge universer.
-- * Et univers der du har vunnet divisjon 1 på Camp Nou har ligaen lukket (player_profiles.league_closed). Der kan du spille
--   draft, åpne pakker, spille vennekamper og 1 mot 1 og oppgradere stadion, men ikke AI-ligakamper: ensure_ai_season lager ingen ny sesong.
-- * Du kan ikke bytte mens en kamp eller draft pågår. Utfordringer og dine annonser og bud i universet du forlater avsluttes.
-- * De som ble flyttet av 0128 mistet de levende radene i univers 1. Her bygges laget og benken opp igjen fra arkivet
--   (universe_archives.snapshot). MB-en, stadionet og kortene utenfor laget finnes ikke i arkivet og må hentes fra en backup.
--   MB settes til 120, som en ny start, til de er hentet tilbake.

alter table player_profiles add column league_closed boolean not null default false;

create table universe_saves (
  user_id uuid not null references profiles(id) on delete cascade,
  universe integer not null check (universe >= 1),
  data jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, universe)
);
alter table universe_saves enable row level security;
grant all on universe_saves to service_role;

-- Lagrer det levende universet i universe_saves og tømmer de levende radene. `closes_league` er sant når mestertittelen
-- er vunnet: da lukkes ligaen i universet som lagres, og overgangsanimasjonen vises (seen_at er null).
-- Det personlige kortet, klubbnivå, XP, venner, profil, Femmer og turneringer er kontoens og blir værende.
create or replace function public.stash_universe(target_user uuid, closes_league boolean default false)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  current_universe integer;
  saved jsonb;
begin
  select universe into current_universe from player_profiles where user_id = target_user for update;
  if not found then return; end if;

  update career_challenges set status = 'expired' where status in ('pending', 'accepted') and target_user in (challenger_id, opponent_id);
  delete from market_bids where bidder_id = target_user;
  delete from market_listings where seller_id = target_user;

  insert into universe_archives (user_id, universe, snapshot, seen_at)
  values (target_user, current_universe, public.universe_snapshot(target_user), case when closes_league then null else now() end)
  on conflict (user_id, universe) do update set snapshot = excluded.snapshot, archived_at = now();

  saved := jsonb_build_object(
    'profile', (select jsonb_build_object('manager_budget', profile.manager_budget, 'manager_budget_earned', profile.manager_budget_earned,
        'stadium_collected_at', profile.stadium_collected_at, 'stadium_xp_collected_at', profile.stadium_xp_collected_at,
        'league_closed', profile.league_closed or closes_league)
      from player_profiles profile where profile.user_id = target_user),
    'personal', (select jsonb_build_object('ladder_start', personal.ladder_start, 'counted_from', personal.counted_from, 'overall', card.overall, 'attributes', card.attributes)
      from personal_cards personal join manager_cards card on card.id = personal.card_id where personal.user_id = target_user),
    'cards', coalesce((select jsonb_agg(to_jsonb(card)) from manager_cards card
      where card.owner_id = target_user and not exists (select 1 from personal_cards personal where personal.card_id = card.id)), '[]'),
    'lineup', (select to_jsonb(lineup) from manager_lineups lineup where lineup.user_id = target_user),
    'packs', coalesce((select jsonb_agg(to_jsonb(pack)) from manager_pack_inventory pack where pack.user_id = target_user), '[]'),
    'special_picks', coalesce((select jsonb_agg(to_jsonb(pick)) from special_picks pick where pick.user_id = target_user and pick.chosen_at is null), '[]'),
    'player_picks', coalesce((select jsonb_agg(to_jsonb(pick)) from player_picks pick where pick.user_id = target_user and pick.chosen_at is null), '[]'),
    'scouts', coalesce((select jsonb_agg(to_jsonb(scout)) from stadium_scouts scout where scout.user_id = target_user), '[]'),
    'buildings', coalesce((select jsonb_agg(to_jsonb(stadium_building)) from stadium_buildings stadium_building where stadium_building.user_id = target_user), '[]'),
    'seasons', coalesce((select jsonb_agg(to_jsonb(season)) from career_ai_seasons season where season.user_id = target_user), '[]'),
    'season_matches', coalesce((select jsonb_agg(to_jsonb(fixture)) from career_season_matches fixture
      where fixture.ai_season_id in (select id from career_ai_seasons where user_id = target_user)), '[]'),
    'arena_unlocks', coalesce((select jsonb_agg(to_jsonb(unlock)) from career_arena_unlocks unlock where unlock.user_id = target_user), '[]'));

  insert into universe_saves (user_id, universe, data) values (target_user, current_universe, saved)
  on conflict (user_id, universe) do update set data = excluded.data, saved_at = now();

  delete from manager_lineups where user_id = target_user;
  delete from manager_cards card where card.owner_id = target_user and not exists (select 1 from personal_cards personal where personal.card_id = card.id);
  delete from manager_pack_inventory where user_id = target_user;
  delete from special_picks where user_id = target_user and chosen_at is null;
  delete from player_picks where user_id = target_user and chosen_at is null;
  delete from stadium_scouts where user_id = target_user;
  delete from stadium_buildings where user_id = target_user;
  delete from career_ai_seasons where user_id = target_user;
  delete from career_arena_unlocks where user_id = target_user;
end;
$fn$;

-- Henter et lagret univers tilbake som det levende. De levende radene må være tømt med stash_universe først.
-- jsonb_populate_recordset bruker ikke standardverdiene til kolonner som mangler i JSON-en. Lagringene fra stash_universe har alle kolonnene,
-- men får en tabell en ny kolonne med not null, må restore_universe oppdateres, ellers feiler gamle lagringer.
create or replace function public.restore_universe(target_user uuid, target_universe integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  saved jsonb;
begin
  select data into saved from universe_saves where user_id = target_user and universe = target_universe for update;
  if not found then raise exception 'universe_missing'; end if;

  update player_profiles
  set manager_budget = (saved->'profile'->>'manager_budget')::integer, manager_budget_earned = (saved->'profile'->>'manager_budget_earned')::integer,
    stadium_collected_at = (saved->'profile'->>'stadium_collected_at')::timestamptz, stadium_xp_collected_at = (saved->'profile'->>'stadium_xp_collected_at')::timestamptz,
    league_closed = (saved->'profile'->>'league_closed')::boolean, universe = target_universe, updated_at = now()
  where user_id = target_user;

  insert into manager_cards select * from jsonb_populate_recordset(null::manager_cards, saved->'cards');
  if jsonb_typeof(saved->'lineup') = 'object' then
    insert into manager_lineups select * from jsonb_populate_recordset(null::manager_lineups, jsonb_build_array(saved->'lineup'));
  end if;
  insert into manager_pack_inventory select * from jsonb_populate_recordset(null::manager_pack_inventory, saved->'packs');
  insert into special_picks select * from jsonb_populate_recordset(null::special_picks, saved->'special_picks');
  insert into player_picks select * from jsonb_populate_recordset(null::player_picks, saved->'player_picks');
  insert into stadium_scouts select * from jsonb_populate_recordset(null::stadium_scouts, saved->'scouts');
  insert into stadium_buildings select * from jsonb_populate_recordset(null::stadium_buildings, saved->'buildings');
  insert into career_arena_unlocks select * from jsonb_populate_recordset(null::career_arena_unlocks, saved->'arena_unlocks');

  -- Det personlige kortet settes til ratingen det hadde i dette universet, før sesongene settes inn, siden sesongene regner den ut på nytt.
  if jsonb_typeof(saved->'personal') = 'object' then
    update personal_cards
    set ladder_start = (saved->'personal'->>'ladder_start')::integer, counted_from = (saved->'personal'->>'counted_from')::timestamptz
    where user_id = target_user;
    update manager_cards card
    set overall = (saved->'personal'->>'overall')::integer, attributes = saved->'personal'->'attributes'
    from personal_cards personal
    where personal.user_id = target_user and personal.card_id = card.id;
  end if;

  insert into career_ai_seasons select * from jsonb_populate_recordset(null::career_ai_seasons, saved->'seasons');
  insert into career_season_matches select * from jsonb_populate_recordset(null::career_season_matches, saved->'season_matches');

  delete from universe_saves where user_id = target_user and universe = target_universe;
end;
$fn$;

-- Bytter til et annet av universene dine. Kampen eller draften du er i, må være ferdig først.
create or replace function public.switch_universe(target_user uuid, target_universe integer)
returns integer
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  current_universe integer;
begin
  select universe into current_universe from player_profiles where user_id = target_user for update;
  if not found then raise exception 'universe_missing'; end if;
  if target_universe = current_universe then return current_universe; end if;
  if not exists (select 1 from universe_saves where user_id = target_user and universe = target_universe) then raise exception 'universe_missing'; end if;
  if exists (select 1 from career_matches where status = 'live' and target_user in (home_user_id, away_user_id))
    or exists (select 1 from career_drafts where user_id = target_user and status in ('drafting', 'active'))
  then raise exception 'universe_busy'; end if;

  perform public.stash_universe(target_user, false);
  perform public.restore_universe(target_user, target_universe);
  return target_universe;
end;
$fn$;

-- Arkiverer universet etter mestertittelen og starter på nytt i det neste. Det gamle universet lagres med lukket liga og kan spilles videre
-- uten ligakamper. Nullstillingen av det nye universet er den samme som i 0128 og 0081, men for én bruker.
create or replace function public.advance_universe(target_user uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  next_universe integer;
begin
  select greatest(universe, coalesce((select max(universe) from universe_saves where user_id = target_user), 0),
    coalesce((select max(universe) from universe_archives where user_id = target_user), 0)) + 1
  into next_universe from player_profiles where user_id = target_user for update;
  if not found then return null; end if;

  perform public.stash_universe(target_user, true);

  update player_profiles
  set manager_budget = 120, manager_budget_earned = 120, universe = next_universe, league_closed = false,
    stadium_collected_at = now(), stadium_xp_collected_at = now(), updated_at = now()
  where user_id = target_user;

  update personal_cards set ladder_start = 0, counted_from = now() where user_id = target_user;
  update manager_cards card set overall = 70, attributes = public.personal_card_attributes(70), location = 'squad'
  from personal_cards personal where personal.user_id = target_user and personal.card_id = card.id;

  perform public.seed_manager_starter_squad(target_user);
  perform public.ensure_ai_season(target_user);
  return next_universe;
end;
$fn$;

-- Ligaen er lukket i et univers der du har vunnet Camp Nou: da lages ingen ny sesong. Ellers lik versjonen i 0062.
create or replace function public.ensure_ai_season(target_user uuid)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  season_id uuid;
  last_season career_ai_seasons%rowtype;
  next_arena integer := 1;
  next_division integer := 10;
begin
  if (select league_closed from player_profiles where user_id = target_user for update) then return null; end if;
  select id into season_id from career_ai_seasons where user_id = target_user and status = 'active';
  if season_id is not null then return season_id; end if;
  select * into last_season from career_ai_seasons where user_id = target_user order by season_number desc limit 1;
  if found then
    next_arena := last_season.arena;
    next_division := last_season.division;
    if last_season.outcome = 'promoted' and last_season.division = 1 then
      next_arena := least(5, last_season.arena + 1); next_division := 10;
    elsif last_season.outcome = 'promoted' then
      next_division := last_season.division - 1;
    elsif last_season.outcome = 'relegated' then
      next_division := least(10, last_season.division + 1);
    end if;
  end if;
  return public.create_ai_season(target_user, next_arena, next_division, coalesce(last_season.season_number, 0) + 1);
end;
$fn$;

revoke all on function public.stash_universe(uuid, boolean) from public, anon, authenticated;
revoke all on function public.restore_universe(uuid, integer) from public, anon, authenticated;
revoke all on function public.switch_universe(uuid, integer) from public, anon, authenticated;
revoke all on function public.advance_universe(uuid) from public, anon, authenticated;
revoke all on function public.ensure_ai_season(uuid) from public, anon, authenticated;
grant execute on function public.stash_universe(uuid, boolean) to service_role;
grant execute on function public.restore_universe(uuid, integer) to service_role;
grant execute on function public.switch_universe(uuid, integer) to service_role;
grant execute on function public.advance_universe(uuid) to service_role;
grant execute on function public.ensure_ai_season(uuid) to service_role;

-- De som ble flyttet av 0128 mistet de levende radene i det gamle universet. Her lages et lagret univers av arkivet: startellever og benk
-- (det personlige kortet er allerede kontoens), lukket liga og en ferdig mestersesong, så arenaen og det personlige kortet regnes riktig.
-- MB settes til 120, og stadionet starter på nytt.
do $$
declare
  archive record;
  personal_card uuid;
  cards jsonb;
  lineup jsonb;
  personal jsonb;
  peak_arena integer;
  last_season integer;
begin
  for archive in
    select a.user_id, a.universe, a.snapshot, a.archived_at from universe_archives a
    join player_profiles profile on profile.user_id = a.user_id
    where a.universe <> profile.universe
      and not exists (select 1 from universe_saves save where save.user_id = a.user_id and save.universe = a.universe)
  loop
    select card_id into personal_card from personal_cards where user_id = archive.user_id;

    with entries as (
      select 'starters' as slot_group, entry.ord, entry.card from jsonb_array_elements(archive.snapshot->'starters') with ordinality as entry(card, ord)
      union all
      select 'bench', entry.ord, entry.card from jsonb_array_elements(archive.snapshot->'bench') with ordinality as entry(card, ord)
    ), built as (
      select entries.*, coalesce(entries.card->>'special' = 'personal', false) as is_personal,
        case when coalesce(entries.card->>'special' = 'personal', false) then personal_card else gen_random_uuid() end as card_id
      from entries
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'id', built.card_id, 'owner_id', archive.user_id,
        'catalog_id', (select cat.id from player_catalog cat where cat.slug = built.card->>'slug' and built.card->>'slug' <> ''),
        'name', built.card->>'name', 'position', built.card->>'position', 'overall', (built.card->>'overall')::integer,
        'attributes', built.card->'attributes',
        'tradable', coalesce(built.card->>'special', '') <> '' or coalesce(built.card->>'club', '') <> 'Academy',
        'is_starter', built.slot_group = 'starters',
        'location', 'squad', 'acquired_price', 0, 'created_at', now(),
        'special_card_id', (select special.id from special_cards special
          where special.kind = built.card->>'special' and special.catalog_id = (select cat.id from player_catalog cat where cat.slug = built.card->>'slug')
          order by abs(special.overall - (built.card->>'overall')::integer) limit 1),
        'alt_positions', coalesce(built.card->'altPositions', '[]'::jsonb)
      )) filter (where not built.is_personal), '[]'::jsonb),
      jsonb_build_object('user_id', archive.user_id, 'formation', coalesce(archive.snapshot->>'formation', '4-3-3'),
        'starters', coalesce(jsonb_agg(built.card_id order by built.ord) filter (where built.slot_group = 'starters' and built.card_id is not null), '[]'::jsonb),
        'bench', coalesce(jsonb_agg(built.card_id order by built.ord) filter (where built.slot_group = 'bench' and built.card_id is not null), '[]'::jsonb),
        'updated_at', now()),
      (select jsonb_build_object('ladder_start', 0, 'counted_from', '-infinity', 'overall', (built.card->>'overall')::integer, 'attributes', built.card->'attributes')
        from built where built.is_personal limit 1)
    into cards, lineup, personal
    from built;

    select coalesce(max((season->>'arena')::integer), 5), coalesce(max((season->>'season_number')::integer), 1)
    into peak_arena, last_season from jsonb_array_elements(archive.snapshot->'seasons') as season;

    insert into universe_saves (user_id, universe, data) values (archive.user_id, archive.universe, jsonb_build_object(
      'profile', jsonb_build_object('manager_budget', 120, 'manager_budget_earned', coalesce((archive.snapshot->>'budget_earned')::integer, 120),
        'stadium_collected_at', now(), 'stadium_xp_collected_at', now(), 'league_closed', true),
      'personal', coalesce(personal, 'null'::jsonb),
      'cards', cards, 'lineup', lineup,
      'packs', '[]'::jsonb, 'special_picks', '[]'::jsonb, 'player_picks', '[]'::jsonb, 'scouts', '[]'::jsonb, 'buildings', '[]'::jsonb,
      'seasons', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'user_id', archive.user_id, 'season_number', last_season, 'division', 1,
        'status', 'completed', 'teams', '[]'::jsonb, 'final_position', 1, 'outcome', 'champion', 'created_at', archive.archived_at,
        'completed_at', archive.archived_at, 'arena', peak_arena)),
      'season_matches', '[]'::jsonb, 'arena_unlocks', '[]'::jsonb));
  end loop;
end $$;
