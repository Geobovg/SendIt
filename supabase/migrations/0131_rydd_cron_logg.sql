-- pg_cron logger hver kjøring i cron.job_run_details og rydder aldri selv. Jobben som avgjør managerkamper kjører hvert 5. sekund
-- (0015), og markedsjobben hvert minutt (0009), så tabellen vokser med omtrent 19 000 rader i døgnet og har ført til at databasen
-- gikk over gratisgrensen på 500 MB.
-- Her slettes alt eldre enn ett døgn nå, og en ny jobb gjør det samme hver natt kl. 03:00 UTC. Selve jobbene røres ikke.
-- Å slette rader gir ikke plassen tilbake til Supabase med en gang (den frigjøres først ved vacuum), så om databasen allerede er
-- skrivebeskyttet, må `truncate cron.job_run_details;` kjøres én gang i SQL-editoren før denne migreringen kan gå gjennom.

do $$ begin
  delete from cron.job_run_details where end_time < now() - interval '1 day';

  if exists (select 1 from cron.job where jobname = 'rydd-cron-logg') then
    perform cron.unschedule('rydd-cron-logg');
  end if;
  perform cron.schedule(
    'rydd-cron-logg',
    '0 3 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '1 day'$job$
  );
end $$;
