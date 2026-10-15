-- Hele arenastigen gjøres lettere. Etter 0107 hadde et lag med snitt 90 bare rundt 25–30 % sjanse for opprykk fra
-- divisjon 1 både i Gamle Gress og på Ullevaal, og et 90-lag tar tid å bygge. Simulering med den ekte kampmotoren
-- (scripts/simulate-arenas.mjs, 300 sesonger, uten kvalik) ga denne sjansen for opprykk fra divisjon 1 med ny kurve:
--   snitt 90: Gamle Gress 54 %, Ullevaal 50 %, Wembley 40 %, Old Trafford 33 %, Camp Nou 21 %
--   snitt 94: 79 %, 75 %, 68 %, 55 %, 45 %
-- Nye tall (divisjon 10–1, avvik for de fem klubbene, skjult bonus):
--   arena 1: 58–80 (var 58–84), avvik -2 -1 0 1 3 (var +5 på toppen), bonus 0
--   arena 2: 76–81 (var 80–85), avvik -2 -1 0 1 2 (var +3 på toppen), bonus 0
--   arena 3: 77–82 (var 82–87), avvik som før, bonus 1
--   arena 4: 79–84 (var 84–89), avvik -1 0 0 1 2 (var -1 0 1 1 2), bonus 1
--   arena 5: 81–86 (var 85–90), avvik -1 0 0 1 2 (var 0 0 1 1 2), bonus 1 (var 2)
-- Divisjon 10 i neste arena er fortsatt lettere enn divisjon 1 i arenaen før. Tallene speiles i src/lib/arenas.ts.

create or replace function public.ai_division_rating(target_arena integer, target_division integer)
returns integer language sql immutable set search_path = public, pg_temp
as $fn$
  select (array[58, 76, 77, 79, 81])[target_arena]
    + round(((array[80, 81, 82, 84, 86])[target_arena] - (array[58, 76, 77, 79, 81])[target_arena]) * (10 - target_division) / 9.0)::integer
$fn$;

create or replace function public.ai_team_offsets(target_arena integer)
returns integer[] language sql immutable set search_path = public, pg_temp
as $fn$
  select case target_arena
    when 1 then array[-2, -1, 0, 1, 3]
    when 2 then array[-2, -1, 0, 1, 2]
    else array[-1, 0, 0, 1, 2] end
$fn$;

create or replace function public.ai_arena_bonus(target_arena integer)
returns integer language sql immutable set search_path = public, pg_temp
as $fn$ select (array[0, 0, 1, 1, 1])[greatest(1, least(target_arena, 5))] $fn$;

-- Sesonger som pågår, får den nye kurven på kampene som ikke er spilt. Spilte kamper står som de er.
-- «kv» er kvalikmotstanderen: en klubb fra divisjonen over, eller fra divisjon 10 i neste arena fra divisjon 1.
update career_ai_seasons season
set teams = (
  select jsonb_agg(
    case
      when entry.team->>'key' = 'kv' then entry.team || jsonb_build_object(
        'rating', least(99, public.ai_division_rating(case when season.division = 1 then least(5, season.arena + 1) else season.arena end, case when season.division = 1 then 10 else season.division - 1 end) + 1),
        'bonus', public.ai_arena_bonus(case when season.division = 1 then least(5, season.arena + 1) else season.arena end))
      when entry.team->>'key' ~ '^ai[0-9]+$' then entry.team || jsonb_build_object(
        'rating', least(99, public.ai_division_rating(season.arena, season.division) + (public.ai_team_offsets(season.arena))[least(5, greatest(1, substring(entry.team->>'key' from 3)::integer))]),
        'bonus', public.ai_arena_bonus(season.arena))
      else entry.team
    end order by entry.ord)
  from jsonb_array_elements(season.teams) with ordinality as entry(team, ord)
)
where season.status = 'active' and jsonb_typeof(season.teams) = 'array' and jsonb_array_length(season.teams) > 0;
