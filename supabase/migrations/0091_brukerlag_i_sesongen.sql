-- Motstanderne i AI-sesongen er nå de andre brukernes lag i stedet for oppdiktede klubber.
-- Arena, divisjon, rating og skjult bonus er som før: hvert lag i `teams` får fortsatt ratingen divisjonen krever,
-- og spillerne skaleres til den ratingen når kampen starter (se userTeamAsOpponent i ai-opponent.ts).
-- Lagene hentes fra en rangering av alle brukere med en gyldig ellever: lave nivåer møter de svakeste lagene,
-- de høyeste nivåene de beste. Er det for få brukere, fylles resten med AI-klubber som før.
-- Et brukerlag i `teams` ser slik ut: {key, name (klubbnavnet), manager (brukernavnet), user_id, rating, bonus}.

-- 1) Brukerne som kan være motstandere, plukket rundt det nivået sesongen er på. Litt tilfeldighet gjør at det
--    ikke blir de samme fem hver gang. Laget rangeres etter snittet av de elleve som starter.
create or replace function public.pick_season_opponents(target_user uuid, target_arena integer, target_division integer, wanted integer, excluded uuid[] default '{}')
returns table (opponent_id uuid, opponent_name text, opponent_manager text, opponent_strength numeric)
language sql
volatile
set search_path = public, pg_temp
as $fn$
  with pool as (
    select l.user_id, coalesce(nullif(pp.club_name, 'Mitt lag'), p.username) as club, p.username, avg(c.overall) as strength
    from manager_lineups l
    join profiles p on p.id = l.user_id
    left join player_profiles pp on pp.user_id = l.user_id
    join manager_cards c on c.owner_id = l.user_id and c.id = any(l.starters)
    where l.user_id <> target_user and not (l.user_id = any(excluded)) and cardinality(l.starters) = 11
    group by l.user_id, pp.club_name, p.username
    having count(distinct c.id) = 11
  ), ranked as (
    select pool.*, row_number() over (order by strength, user_id) - 1 as rank, count(*) over () as total from pool
  )
  -- Nivå 0 er arena 1 divisjon 10, nivå 49 er Camp Nou divisjon 1.
  select user_id, club, username, strength from ranked
  order by abs(rank - round((total - 1) * ((target_arena - 1) * 10 + (10 - target_division)) / 49.0)) + random() * 3
  limit greatest(wanted, 0);
$fn$;

-- 2) Nye sesonger får brukerlag. Det svakeste laget får det laveste avviket, så rekkefølgen i tabellen stemmer
--    med hvem som faktisk er best. Ellers lik versjonen i 0062.
create or replace function public.create_ai_season(target_user uuid, target_arena integer, target_division integer, target_number integer)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  picked text[];
  base integer := public.ai_division_rating(target_arena, target_division);
  offsets integer[] := public.ai_team_offsets(target_arena);
  bonus integer := public.ai_arena_bonus(target_arena);
  teams jsonb := '[]';
  opponent record;
  filled integer := 0;
  season_id uuid;
  -- Deltaker 0 er brukeren, 1–5 er motstanderne.
  rotation integer[];
  lineup integer[];
  round_index integer;
  pair_index integer;
  a integer;
  b integer;
  home_part integer;
  away_part integer;
begin
  for opponent in
    select * from public.pick_season_opponents(target_user, target_arena, target_division, 5) order by opponent_strength
  loop
    filled := filled + 1;
    teams := teams || jsonb_build_object('key', 'ai' || filled, 'name', opponent.opponent_name, 'manager', opponent.opponent_manager,
      'user_id', opponent.opponent_id, 'rating', least(99, base + offsets[filled]), 'bonus', bonus);
  end loop;

  if filled < 5 then
    select array_agg(name) into picked from (
      select name from unnest(public.ai_club_names()) as name
      where name not in (select entry.team->>'name' from jsonb_array_elements(teams) as entry(team))
      order by random() limit 5 - filled
    ) as chosen;
    for i in (filled + 1)..5 loop
      teams := teams || jsonb_build_object('key', 'ai' || i, 'name', picked[i - filled], 'rating', least(99, base + offsets[i]), 'bonus', bonus);
    end loop;
  end if;

  insert into career_ai_seasons (user_id, season_number, arena, division, teams)
  values (target_user, target_number, target_arena, target_division, teams)
  returning id into season_id;

  -- Rundkast med sirkelmetoden: deltaker 0 står fast, resten roterer. Andre halvdel speiler første med byttet hjemmebane.
  rotation := array[1, 2, 3, 4, 5];
  for round_index in 0..4 loop
    lineup := array[0] || rotation[(round_index % 5) + 1:5] || rotation[1:(round_index % 5)];
    for pair_index in 0..2 loop
      a := lineup[pair_index + 1];
      b := lineup[6 - pair_index];
      if (round_index + pair_index) % 2 = 0 then home_part := a; away_part := b; else home_part := b; away_part := a; end if;
      insert into career_season_matches (ai_season_id, round, home_user_id, home_ai_key, away_user_id, away_ai_key)
      values (season_id, round_index + 1,
        case when home_part = 0 then target_user end, case when home_part <> 0 then 'ai' || home_part end,
        case when away_part = 0 then target_user end, case when away_part <> 0 then 'ai' || away_part end);
      insert into career_season_matches (ai_season_id, round, home_user_id, home_ai_key, away_user_id, away_ai_key)
      values (season_id, round_index + 6,
        case when away_part = 0 then target_user end, case when away_part <> 0 then 'ai' || away_part end,
        case when home_part = 0 then target_user end, case when home_part <> 0 then 'ai' || home_part end);
    end loop;
  end loop;

  return season_id;
end;
$fn$;

-- 3) Kvalikmotstanderen er også et brukerlag, hentet fra nivået over og ikke et av lagene i sesongen.
--    Ellers lik versjonen i 0082.
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
  -- Neste sesong starter med en gang, så «Spill neste kamp» aldri står tom.
  perform public.ensure_ai_season(season_row.user_id);
end;
$fn$;

revoke all on function public.pick_season_opponents(uuid, integer, integer, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.pick_season_opponents(uuid, integer, integer, integer, uuid[]) to service_role;

-- 4) Sesongene som er i gang, får brukerlag med en gang. Bare navnet og hvem laget tilhører byttes:
--    nøkkel, rating og bonus står, så tabellen, poengene og resultatene er de samme som før.
--    Det svakeste brukerlaget tar plassen til klubben med lavest rating, osv. Kvalikmotstanderen byttes også.
--    Kamper som allerede er spilt, beholder navnet på AI-klubben de ble spilt mot.
do $$
declare
  season_row record;
  league_keys text[];
  picked jsonb;
  kv_team jsonb;
  opponent record;
  kv_arena integer;
  kv_division integer;
begin
  for season_row in select id, user_id, arena, division, teams from career_ai_seasons where status = 'active' loop
    select array_agg(entry.team->>'key' order by (entry.team->>'rating')::integer, entry.team->>'key') into league_keys
    from jsonb_array_elements(season_row.teams) as entry(team)
    where entry.team->>'key' <> 'kv' and not entry.team ? 'user_id';
    if league_keys is null then continue; end if;

    select coalesce(jsonb_object_agg(league_keys[o.slot::integer], jsonb_build_object('name', o.opponent_name, 'manager', o.opponent_manager, 'user_id', o.opponent_id)), '{}')
    into picked
    from (
      select chosen.*, row_number() over (order by chosen.opponent_strength) as slot
      from public.pick_season_opponents(season_row.user_id, season_row.arena, season_row.division, cardinality(league_keys)) as chosen
    ) as o;

    kv_team := null;
    if exists (select 1 from jsonb_array_elements(season_row.teams) as entry(team) where entry.team->>'key' = 'kv' and not entry.team ? 'user_id') then
      if season_row.division = 1 then kv_arena := season_row.arena + 1; kv_division := 10;
      else kv_arena := season_row.arena; kv_division := season_row.division - 1; end if;
      select * into opponent from public.pick_season_opponents(season_row.user_id, kv_arena, kv_division, 1,
        coalesce((select array_agg((value->>'user_id')::uuid) from jsonb_each(picked)), '{}')
        || coalesce((select array_agg((entry.team->>'user_id')::uuid) from jsonb_array_elements(season_row.teams) as entry(team) where entry.team ? 'user_id'), '{}'));
      if found then kv_team := jsonb_build_object('name', opponent.opponent_name, 'manager', opponent.opponent_manager, 'user_id', opponent.opponent_id); end if;
    end if;

    if picked = '{}' and kv_team is null then continue; end if;
    update career_ai_seasons
    set teams = (
      select jsonb_agg(case
        when picked ? (entry.team->>'key') then entry.team || (picked->(entry.team->>'key'))
        when entry.team->>'key' = 'kv' and kv_team is not null and not entry.team ? 'user_id' then entry.team || kv_team
        else entry.team end order by entry.idx)
      from jsonb_array_elements(season_row.teams) with ordinality as entry(team, idx)
    )
    where id = season_row.id;
  end loop;
end $$;
