-- Brukerlagene i sesongen het «My team» (standard klubbnavn), så 0091 viste samme navn på alle.
-- Nå heter hvert brukerlag det brukeren heter, både i nye sesonger og i dem som er i gang.

-- 1) Lik versjonen i 0091, men navnet er alltid brukernavnet.
create or replace function public.pick_season_opponents(target_user uuid, target_arena integer, target_division integer, wanted integer, excluded uuid[] default '{}')
returns table (opponent_id uuid, opponent_name text, opponent_manager text, opponent_strength numeric)
language sql
volatile
set search_path = public, pg_temp
as $fn$
  with pool as (
    select l.user_id, p.username, avg(c.overall) as strength
    from manager_lineups l
    join profiles p on p.id = l.user_id
    join manager_cards c on c.owner_id = l.user_id and c.id = any(l.starters)
    where l.user_id <> target_user and not (l.user_id = any(excluded)) and cardinality(l.starters) = 11
    group by l.user_id, p.username
    having count(distinct c.id) = 11
  ), ranked as (
    select pool.*, row_number() over (order by strength, user_id) - 1 as rank, count(*) over () as total from pool
  )
  -- Nivå 0 er arena 1 divisjon 10, nivå 49 er Camp Nou divisjon 1.
  select user_id, username, username, strength from ranked
  order by abs(rank - round((total - 1) * ((target_arena - 1) * 10 + (10 - target_division)) / 49.0)) + random() * 3
  limit greatest(wanted, 0);
$fn$;

-- 2) Sesongene som allerede har brukerlag, får brukernavnet som lagnavn.
update career_ai_seasons s
set teams = (
  select jsonb_agg(case
    when entry.team ? 'user_id' then entry.team || jsonb_build_object('name', coalesce(p.username, entry.team->>'name'), 'manager', coalesce(p.username, entry.team->>'manager'))
    else entry.team end order by entry.idx)
  from jsonb_array_elements(s.teams) with ordinality as entry(team, idx)
  left join profiles p on p.id = (entry.team->>'user_id')::uuid
)
where exists (select 1 from jsonb_array_elements(s.teams) as entry(team) where entry.team ? 'user_id');
