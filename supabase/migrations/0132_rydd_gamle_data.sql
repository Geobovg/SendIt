-- Databasen gikk over gratisgrensen på 500 MB. De tre største tabellene var career_matches (112 MB), cron.job_run_details (107 MB, ryddes av 0131)
-- og pack_openings (100 MB). Begge de to siste vokser for alltid, og appen leser bare nye rader fra dem. Her ryddes det hver natt.
-- * pack_openings: appen teller bare åpninger siden starten av uka/dagen (dagens og ukens kjøpsgrenser) og leser den siste åpningen i samme
--   transaksjon som åpningen. Rader eldre enn 14 dager slettes.
-- * career_matches: events (hele kamphendelsene som JSON) er det som tar plass. Kamper eldre enn 14 dager slettes, unntatt
--   - de 8 siste fullførte kampene til hver manager (kamphistorikken viser 8, og kan spille av kampen igjen),
--   - kamper i en sesong som ikke er ferdig (kampoppsettet lenker til dem, og kvalikkens straffer leses når sesongen avgjøres).
--   Fra standings og sesongkampene leses bare resultatene, og de ligger i career_season_matches. career_season_matches.match_id og
--   career_draft_fixtures.match_id settes til null når kampen slettes, og career_match_shots slettes sammen med kampen.
--   Gamle kamper som aldri ble spilt (lobby) og walkovere slettes også.
-- Første kjøring gjør oppryddingen nå, den nattlige jobben (kl. 03:10 UTC) holder tabellene små etter det. Slettede rader frigjør ikke
-- plassen til Supabase før tabellen er pakket på nytt, så kjør `vacuum full public.career_matches;` og `vacuum full public.pack_openings;`
-- én gang i SQL-editoren etterpå.

create or replace function public.rydd_gamle_data()
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  delete from pack_openings where created_at < now() - interval '14 days';

  with participants as (
    select id, home_user_id as user_id, completed_at from career_matches where mode = 'manager' and status = 'completed' and home_user_id is not null
    union all
    select id, away_user_id, completed_at from career_matches where mode = 'manager' and status = 'completed' and away_user_id is not null
  ), latest as (
    select id from (
      select id, row_number() over (partition by user_id order by completed_at desc nulls last) as place from participants
    ) ranked where place <= 8
  )
  delete from career_matches m
  where m.status in ('completed', 'forfeit', 'lobby')
    and coalesce(m.completed_at, m.created_at) < now() - interval '14 days'
    and m.id not in (select id from latest)
    and not exists (
      select 1 from career_season_matches fixture
      left join career_ai_seasons ai_season on ai_season.id = fixture.ai_season_id
      left join career_friend_seasons friend_season on friend_season.id = fixture.friend_season_id
      where fixture.match_id = m.id and (ai_season.status = 'active' or friend_season.status in ('open', 'active'))
    );
end
$fn$;

revoke all on function public.rydd_gamle_data() from public, anon, authenticated;
grant execute on function public.rydd_gamle_data() to service_role;

select public.rydd_gamle_data();

do $$ begin
  if exists (select 1 from cron.job where jobname = 'rydd-gamle-data') then
    perform cron.unschedule('rydd-gamle-data');
  end if;
  perform cron.schedule('rydd-gamle-data', '10 3 * * *', 'select public.rydd_gamle_data()');
end $$;
