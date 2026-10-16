-- Spøk: alle Femmer-kortene til f_edits blir 67 og vises som pølser i ti timer. Deretter settes de tilbake av seg selv.
-- five_card_prank husker ratingen kortene hadde og når spøken er slutt. Finnes kortet i tabellen, vises det som pølse.
create table if not exists five_card_prank (
  card_id uuid primary key references five_cards(id) on delete cascade,
  original_overall integer not null,
  expires_at timestamptz not null
);
alter table five_card_prank enable row level security;

-- Setter tilbake kortene der tiden er ute. Fremgang som kom mens kortene var 67 (XP, oppgraderinger) beholdes.
create or replace function public.end_five_card_prank()
returns void language plpgsql set search_path = public, pg_temp
as $fn$
begin
  update five_cards card
  set overall = least(99, prank.original_overall + greatest(0, card.overall - 67))
  from five_card_prank prank
  where prank.card_id = card.id and prank.expires_at <= now();
  delete from five_card_prank where expires_at <= now();
  -- Ingen kort igjen: jobben har gjort seg ferdig og fjerner seg selv.
  if not exists (select 1 from five_card_prank) and exists (select 1 from cron.job where jobname = 'five-card-prank-end') then
    perform cron.unschedule('five-card-prank-end');
  end if;
end;
$fn$;
revoke all on function public.end_five_card_prank() from public, anon, authenticated;
grant execute on function public.end_five_card_prank() to service_role;

do $$
declare
  target uuid;
begin
  select id into target from profiles where username_key = 'f_edits';
  if target is null then
    raise notice 'Fant ingen bruker med brukernavnet f_edits';
    return;
  end if;
  insert into five_card_prank (card_id, original_overall, expires_at)
  select id, overall, now() + interval '10 hours' from five_cards where owner_id = target
  on conflict (card_id) do nothing;
  update five_cards set overall = 67 where id in (select card_id from five_card_prank);
  perform cron.schedule('five-card-prank-end', '* * * * *', 'select public.end_five_card_prank()');
end $$;
