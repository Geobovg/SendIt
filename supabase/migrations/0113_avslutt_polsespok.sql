-- Avslutter pølsespøken (0111) med en gang: kortene til f_edits settes tilbake og cron-jobben fjernes.
update manager_card_prank set expires_at = now();
select public.end_manager_card_prank();

-- Sikkerhetsnett hvis jobben skulle bli stående, f.eks. fordi tabellen var tom.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'manager-card-prank-end') then
    perform cron.unschedule('manager-card-prank-end');
  end if;
end $$;
