-- Spøk: alle managerkortene til f_edits blir 67 og vises som pølser i ti timer. Deretter settes de tilbake av seg selv.
-- manager_card_prank husker ratingen og attributtene kortene hadde, og når spøken er slutt. Finnes kortet i tabellen, vises det som pølse.
create table if not exists manager_card_prank (
  card_id uuid primary key references manager_cards(id) on delete cascade,
  original_overall integer not null,
  original_attributes jsonb not null,
  expires_at timestamptz not null
);
alter table manager_card_prank enable row level security;

-- Setter tilbake kortene der tiden er ute. Fremgang som kom mens kortene var 67 beholdes, bortsett fra personlige kort,
-- som regnes ut på nytt fra AI-stigen.
create or replace function public.end_manager_card_prank()
returns void language plpgsql set search_path = public, pg_temp
as $fn$
declare
  owner uuid;
begin
  update manager_cards card
  set overall = case when card.position = 'ALL' then prank.original_overall else least(99, prank.original_overall + greatest(0, card.overall - 67)) end,
      attributes = prank.original_attributes
  from manager_card_prank prank
  where prank.card_id = card.id and prank.expires_at <= now();
  for owner in select distinct card.owner_id from manager_cards card join manager_card_prank prank on prank.card_id = card.id
    where prank.expires_at <= now() and card.position = 'ALL' loop
    perform public.refresh_personal_card(owner);
  end loop;
  delete from manager_card_prank where expires_at <= now();
  -- Ingen kort igjen: jobben har gjort seg ferdig og fjerner seg selv.
  if not exists (select 1 from manager_card_prank) and exists (select 1 from cron.job where jobname = 'manager-card-prank-end') then
    perform cron.unschedule('manager-card-prank-end');
  end if;
end;
$fn$;
revoke all on function public.end_manager_card_prank() from public, anon, authenticated;
grant execute on function public.end_manager_card_prank() to service_role;

do $$
declare
  target uuid;
begin
  select id into target from profiles where username_key = 'f_edits';
  if target is null then
    raise notice 'Fant ingen bruker med brukernavnet f_edits';
    return;
  end if;
  insert into manager_card_prank (card_id, original_overall, original_attributes, expires_at)
  select id, overall, attributes, now() + interval '10 hours' from manager_cards where owner_id = target
  on conflict (card_id) do nothing;
  update manager_cards
  set overall = 67,
      attributes = jsonb_build_object('pace', 67, 'shooting', 67, 'passing', 67, 'dribbling', 67, 'defending', 67, 'physical', 67)
  where id in (select card_id from manager_card_prank);
  perform cron.schedule('manager-card-prank-end', '* * * * *', 'select public.end_manager_card_prank()');
end $$;
