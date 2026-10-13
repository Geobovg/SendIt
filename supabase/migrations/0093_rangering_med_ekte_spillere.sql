-- Mange har fortsatt Academy-troppen fra nullstillingen (0081) som lagret lag, fordi nye kort aldri legges inn
-- i laget av seg selv. Da ble de rangert som de svakeste lagene selv om de har bedre spillere.
-- Står laget fortsatt som Academy-troppen, rangeres brukeren nå etter snittet av de elleve beste kortene sine.
-- Det er de spillerne andre ser og møter (se realPlayers i manager-snapshot.ts). Ellers lik versjonen i 0092.
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
