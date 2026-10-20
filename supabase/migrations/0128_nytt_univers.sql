-- Nytt univers: vinner du divisjon 1 på Camp Nou, sendes du til et nytt univers med ny start (se docs/adr/0005-univers.md).
-- * Du starter i divisjon 10 i første arena, med Academy-tropp, 120 MB og et nytt stadion. Klubbnivå, XP, venner, profil,
--   Femmer, turneringer og det personlige kortet (satt tilbake til 70) følger med.
-- * Det gamle universet fryses som et øyeblikksbilde i universe_archives: laget, kortene, statistikken og sesongene.
--   Det kan ses, men ikke spilles. seen_at er null til spilleren har sett overgangsanimasjonen.
-- * Motstandere i AI-sesongen hentes bare fra samme univers. Marked og overføringer holdes adskilt i serverkoden.
-- * De som allerede hadde vunnet Camp Nou (en mestertittel etter nullstillingen 8. oktober 2026), flyttes med denne migreringen.

alter table player_profiles add column universe integer not null default 1 check (universe >= 1);

create table universe_archives (
  user_id uuid not null references profiles(id) on delete cascade,
  universe integer not null check (universe >= 1),
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, universe)
);
alter table universe_archives enable row level security;
grant all on universe_archives to service_role;

-- Ett kort slik det vises på et kort: samme felt som PlayerCardFace trenger.
create or replace function public.universe_card_json(target_card uuid)
returns jsonb language sql stable set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
    'name', c.name, 'position', c.position, 'altPositions', to_jsonb(c.alt_positions), 'overall', c.overall,
    'attributes', c.attributes,
    'slug', coalesce(personal.slug, cat.slug, ''),
    'accent', coalesce(cat.accent, '#35d06a'),
    'club', case when personal.card_id is not null then profile.club_name else coalesce(cat.club, 'Academy') end,
    'special', case when personal.card_id is not null then 'personal' else special.kind end,
    'nation', cat.nation)
  from manager_cards c
  left join player_catalog cat on cat.id = c.catalog_id
  left join special_cards special on special.id = c.special_card_id
  left join personal_cards personal on personal.card_id = c.id
  left join player_profiles profile on profile.user_id = c.owner_id
  where c.id = target_card
$fn$;

-- Øyeblikksbildet av universet slik det står nå.
create or replace function public.universe_snapshot(target_user uuid)
returns jsonb language sql stable set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
    'club_name', profile.club_name, 'club_xp', profile.club_xp, 'budget_earned', profile.manager_budget_earned,
    'wins', profile.manager_career_wins, 'draws', profile.manager_career_draws, 'losses', profile.manager_career_losses,
    'formation', lineup.formation,
    'rating', (select round(avg(card.overall))::integer from manager_cards card where lineup.starters is not null and card.id = any(lineup.starters)),
    'starters', coalesce((select jsonb_agg(public.universe_card_json(entry.id) order by entry.ord) from unnest(lineup.starters) with ordinality as entry(id, ord)), '[]'),
    'bench', coalesce((select jsonb_agg(public.universe_card_json(entry.id) order by entry.ord) from unnest(lineup.bench) with ordinality as entry(id, ord)), '[]'),
    'card_count', (select count(*) from manager_cards where owner_id = target_user),
    'seasons', coalesce((select jsonb_agg(jsonb_build_object('season_number', season.season_number, 'arena', season.arena, 'division', season.division,
        'final_position', season.final_position, 'outcome', season.outcome) order by season.season_number)
      from career_ai_seasons season where season.user_id = target_user and season.status = 'completed'), '[]'))
  from player_profiles profile
  left join manager_lineups lineup on lineup.user_id = profile.user_id
  where profile.user_id = target_user
$fn$;

-- Arkiverer universet og starter på nytt i det neste. Nullstillingen er den samme som i migrering 0081, men for én bruker.
create or replace function public.advance_universe(target_user uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  old_universe integer;
begin
  select universe into old_universe from player_profiles where user_id = target_user for update;
  if not found then return null; end if;

  insert into universe_archives (user_id, universe, snapshot)
  values (target_user, old_universe, public.universe_snapshot(target_user))
  on conflict (user_id, universe) do nothing;

  update career_challenges set status = 'expired' where status in ('pending', 'accepted') and target_user in (challenger_id, opponent_id);
  delete from market_bids where bidder_id = target_user;
  delete from market_listings where seller_id = target_user;
  delete from manager_lineups where user_id = target_user;
  delete from manager_cards card where card.owner_id = target_user and not exists (select 1 from personal_cards personal where personal.card_id = card.id);
  delete from manager_pack_inventory where user_id = target_user;
  delete from special_picks where user_id = target_user and chosen_at is null;
  delete from player_picks where user_id = target_user and chosen_at is null;
  delete from stadium_scouts where user_id = target_user;
  delete from stadium_buildings where user_id = target_user;
  delete from career_ai_seasons where user_id = target_user;
  delete from career_arena_unlocks where user_id = target_user;

  update player_profiles
  set manager_budget = 120, manager_budget_earned = 120, universe = old_universe + 1,
    stadium_collected_at = now(), stadium_xp_collected_at = now(), updated_at = now()
  where user_id = target_user;

  update personal_cards set ladder_start = 0, counted_from = now() where user_id = target_user;
  update manager_cards card set overall = 70, attributes = public.personal_card_attributes(70), location = 'squad'
  from personal_cards personal where personal.user_id = target_user and personal.card_id = card.id;

  perform public.seed_manager_starter_squad(target_user);
  perform public.ensure_ai_season(target_user);
  return old_universe + 1;
end;
$fn$;

-- Motstanderne i AI-sesongen kommer bare fra samme univers. Ellers lik versjonen i 0093.
create or replace function public.pick_season_opponents(target_user uuid, target_arena integer, target_division integer, wanted integer, excluded uuid[] default '{}')
returns table (opponent_id uuid, opponent_name text, opponent_manager text, opponent_strength numeric)
language sql
volatile
set search_path = public, pg_temp
as $fn$
  with pool as (
    select l.user_id, p.username, avg(c.overall) as starters_strength,
      -- Startkortene fra nullstillingen: ingen katalograd, ikke spesial- eller personlige kort.
      bool_and(c.catalog_id is null and c.special_card_id is null and c.name like 'Academy %'
        and not exists (select 1 from personal_cards pc where pc.card_id = c.id)) as academy_only
    from manager_lineups l
    join profiles p on p.id = l.user_id
    join player_profiles universe_profile on universe_profile.user_id = l.user_id
      and universe_profile.universe = (select universe from player_profiles where user_id = target_user)
    join manager_cards c on c.owner_id = l.user_id and c.id = any(l.starters)
    where l.user_id <> target_user and not (l.user_id = any(excluded)) and cardinality(l.starters) = 11
    group by l.user_id, p.username
    having count(distinct c.id) = 11
  ), rated as (
    select user_id, username,
      case when academy_only then (
        select avg(best.overall) from (select overall from manager_cards where owner_id = pool.user_id order by overall desc limit 11) as best
      ) else starters_strength end as strength
    from pool
  ), ranked as (
    select rated.*, row_number() over (order by strength, user_id) - 1 as rank, count(*) over () as total from rated
  )
  -- Nivå 0 er arena 1 divisjon 10, nivå 49 er Camp Nou divisjon 1.
  select user_id, username, username, strength from ranked
  order by abs(rank - round((total - 1) * ((target_arena - 1) * 10 + (10 - target_division)) / 49.0)) + random() * 3
  limit greatest(wanted, 0);
$fn$;

-- finish_ai_season: mestertittelen sender deg til neste univers i stedet for å la deg bli på Camp Nou. Ellers lik versjonen i 0091.
create or replace function public.finish_ai_season(target_season uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  season_row career_ai_seasons%rowtype;
  playoff career_season_matches%rowtype;
  user_position integer;
  next_outcome text;
  factor numeric;
  new_arena integer;
  new_division integer;
  opponent record;
  opponent_team jsonb;
  opponent_name text;
  opponent_arena integer;
  opponent_division integer;
  opponent_rating integer;
begin
  select * into season_row from career_ai_seasons where id = target_season for update;
  if not found or season_row.status <> 'active' then return; end if;
  if exists (select 1 from career_season_matches where ai_season_id = target_season and stage = 'league' and status <> 'completed') then return; end if;
  factor := public.ai_arena_factor(season_row.arena);

  select table_position into user_position from public.season_standings(target_season, null) where participant = season_row.user_id::text;

  select * into playoff from career_season_matches where ai_season_id = target_season and stage = 'playoff';
  if found then
    if playoff.status <> 'completed' then return; end if;
    -- Brukeren står alltid som hjemmelag i kvalikkampen. Står det likt etter ekstraomgangene, avgjør straffene.
    next_outcome := case
      when playoff.home_score > playoff.away_score then 'promoted'
      when playoff.home_score = playoff.away_score and exists (
        select 1 from career_matches m
        where m.id = playoff.match_id and m.home_penalties > m.away_penalties
      ) then 'promoted'
      else 'stayed' end;
  elsif user_position = public.ai_playoff_position(season_row.arena, season_row.division) then
    -- Motstanderen er en klubb fra divisjonen over, eller fra divisjon 10 i neste arena.
    if season_row.division = 1 then opponent_arena := season_row.arena + 1; opponent_division := 10;
    else opponent_arena := season_row.arena; opponent_division := season_row.division - 1; end if;
    opponent_rating := least(99, public.ai_division_rating(opponent_arena, opponent_division) + 1);
    select * into opponent from public.pick_season_opponents(season_row.user_id, opponent_arena, opponent_division, 1,
      coalesce((select array_agg((entry.team->>'user_id')::uuid) from jsonb_array_elements(season_row.teams) as entry(team) where entry.team ? 'user_id'), '{}'));
    if found then
      opponent_team := jsonb_build_object('key', 'kv', 'name', opponent.opponent_name, 'manager', opponent.opponent_manager,
        'user_id', opponent.opponent_id, 'rating', opponent_rating, 'bonus', public.ai_arena_bonus(opponent_arena));
    else
      select name into opponent_name from unnest(public.ai_club_names()) as name
      where name not in (select entry.team->>'name' from jsonb_array_elements(season_row.teams) as entry(team))
      order by random() limit 1;
      opponent_team := jsonb_build_object('key', 'kv', 'name', opponent_name, 'rating', opponent_rating, 'bonus', public.ai_arena_bonus(opponent_arena));
    end if;
    update career_ai_seasons set teams = teams || jsonb_build_array(opponent_team) where id = target_season;
    insert into career_season_matches (ai_season_id, round, stage, home_user_id, away_ai_key)
    values (target_season, 11, 'playoff', season_row.user_id, 'kv');
    return;
  else
    next_outcome := case
      when user_position = 1 and season_row.division = 1 and season_row.arena >= 5 then 'champion'
      when user_position <= public.ai_direct_promotion_spots(season_row.arena, season_row.division) then 'promoted'
      when user_position >= 5 and season_row.division < 10 then 'relegated'
      else 'stayed' end;
  end if;

  update career_ai_seasons set status = 'completed', final_position = user_position, outcome = next_outcome, completed_at = now() where id = target_season;

  -- Bare opprykk gir premie: MB og én pakke som blir bedre jo høyere man rykker opp. Plasseringen gir ingenting.
  -- grant_season_budget er idempotent, så pakken gis bare første gang premien for sesongen deles ut.
  if next_outcome = 'promoted' and season_row.division > 1 then
    new_division := season_row.division - 1;
    if public.grant_season_budget(season_row.user_id, target_season, 'promotion_d' || new_division, floor(25 * (11 - new_division) * factor)::integer) then
      perform public.grant_pack(season_row.user_id, case when new_division >= 7 then 'gullpakke' when new_division >= 2 then 'premium_gull' else 'sjeldne_spillere' end, 1);
    end if;
  elsif next_outcome = 'promoted' then
    new_arena := season_row.arena + 1;
    if public.grant_season_budget(season_row.user_id, target_season, 'promotion_a' || new_arena, floor(25 * 11 * factor)::integer) then
      perform public.grant_pack(season_row.user_id, 'jumbo_premium_gull', 1);
    end if;
    insert into career_arena_unlocks (user_id, arena) values (season_row.user_id, new_arena) on conflict do nothing;
  end if;

  perform public.grant_club_xp(season_row.user_id, floor((50 + (10 - season_row.division) * 10) * factor)::integer);
  if next_outcome = 'champion' then
    -- Mestertittelen på Camp Nou sender deg til et nytt univers med ny start. Det gamle arkiveres.
    perform public.advance_universe(season_row.user_id);
  else
    -- Neste sesong starter med en gang, så «Spill neste kamp» aldri står tom.
    perform public.ensure_ai_season(season_row.user_id);
  end if;
end;
$fn$;

revoke all on function public.universe_card_json(uuid) from public, anon, authenticated;
revoke all on function public.universe_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.advance_universe(uuid) from public, anon, authenticated;
revoke all on function public.pick_season_opponents(uuid, integer, integer, integer, uuid[]) from public, anon, authenticated;
revoke all on function public.finish_ai_season(uuid) from public, anon, authenticated;
grant execute on function public.universe_card_json(uuid) to service_role;
grant execute on function public.universe_snapshot(uuid) to service_role;
grant execute on function public.advance_universe(uuid) to service_role;
grant execute on function public.pick_season_opponents(uuid, integer, integer, integer, uuid[]) to service_role;
grant execute on function public.finish_ai_season(uuid) to service_role;

-- De som allerede har vunnet Camp Nou, flyttes til univers 2. Bare mestertitler etter nullstillingen i 0081 (8. oktober 2026) teller,
-- siden alle ble satt tilbake til Gamle Gress da.
do $$
declare
  winner uuid;
begin
  for winner in select distinct user_id from career_ai_seasons where outcome = 'champion' and completed_at >= timestamptz '2026-10-09 00:00:00+00' loop
    perform public.advance_universe(winner);
  end loop;
end $$;
