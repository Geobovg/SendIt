-- Fantasy-jobben kalte /api/fantasy/tick hvert andre minutt og brukte for mye av gratisplanen hos Vercel.
-- Den stoppes her. Koden og dataene står igjen, så den kan settes opp igjen (se docs/fantasy-cron.md).
do $$ begin
  if exists (select 1 from cron.job where jobname = 'fantasy-tick') then
    perform cron.unschedule('fantasy-tick');
  end if;
end $$;
