-- Motstanden i arena 2–5 var for god. Simulering med den ekte kampmotoren (hele sesonger, kjemi som i vanlige lag)
-- viste at et lag med snittrating 90 hadde 18 % sjanse for opprykk fra divisjon 1 i arena 1, 17 % i divisjon 1 i arena 2,
-- 10 % i divisjon 1 i arena 3 og 0–3 % i arena 4 og 5. Selv et lag på 94 hadde bare 0–5 % på toppen av Old Trafford og
-- Camp Nou, og det beste mulige laget har snitt rundt 89–92. AI-ratingen og den skjulte bonusen trekkes derfor ned:
--   arena 2: 79–84 (var 82–87), bonus 0 (var 1)
--   arena 3: 81–86 (var 86–90), bonus 1 (var 2)
--   arena 4: 83–88 (var 88–94), bonus 1 (var 3)
--   arena 5: 85–90 (var 91–97), bonus 2 (var 4)
-- Arena 1 er som før. Etter endringen har et lag på 90 omtrent 85 % sjanse for opprykk i divisjon 10 i arena 2, 65 % i
-- divisjon 10 i arena 4 og 5–10 % i divisjon 1 på Camp Nou; et lag på 94 har rundt 20 % der (npm run sim:arenas). Tallene speiles i src/lib/arenas.ts.
-- Divisjonene imellom fordeles jevnt, og avvikene mellom klubbene i hver divisjon (ai_team_offsets) er uendret.

create or replace function public.ai_division_rating(target_arena integer, target_division integer)
returns integer language sql immutable set search_path = public, pg_temp
as $fn$
  select (array[58, 79, 81, 83, 85])[target_arena]
    + round(((array[84, 84, 86, 88, 90])[target_arena] - (array[58, 79, 81, 83, 85])[target_arena]) * (10 - target_division) / 9.0)::integer
$fn$;

create or replace function public.ai_arena_bonus(target_arena integer)
returns integer language sql immutable set search_path = public, pg_temp
as $fn$ select (array[0, 0, 1, 1, 2])[greatest(1, least(target_arena, 5))] $fn$;

-- Sesonger som pågår i arena 2–5 får den nye kurven på kampene som ikke er spilt. Spilte kamper står som de er.
-- «kv» er kvalikmotstanderen: en klubb fra divisjonen over, eller fra divisjon 10 i neste arena fra divisjon 1.
update career_ai_seasons season
set teams = (
  select jsonb_agg(
    case
      when entry.team->>'key' = 'kv' then entry.team || jsonb_build_object(
        'rating', least(99, public.ai_division_rating(case when season.division = 1 then least(5, season.arena + 1) else season.arena end, case when season.division = 1 then 10 else season.division - 1 end) + 1),
        'bonus', public.ai_arena_bonus(case when season.division = 1 then least(5, season.arena + 1) else season.arena end))
      else entry.team || jsonb_build_object(
        'rating', least(99, public.ai_division_rating(season.arena, season.division) + (public.ai_team_offsets(season.arena))[least(5, greatest(1, substring(entry.team->>'key' from 3)::integer))]),
        'bonus', public.ai_arena_bonus(season.arena))
    end order by entry.ord)
  from jsonb_array_elements(season.teams) with ordinality as entry(team, ord)
)
where season.status = 'active' and season.arena >= 2;
