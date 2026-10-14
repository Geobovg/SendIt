-- Spillervalg: en gave til alle managere. Fem tilfeldige spesialkort (inform og honorable mention), og man velger ett
-- som havner i klubben. Hvor mange av hver type man får, er tilfeldig (0–5 honorable mentions, resten informs), og
-- ingen spiller kan stå to ganger blant de fem, selv om han har flere spesialkort (flere inform-uker, inform og HM).
-- Kortet legges i troppen, eller på lageret hvis troppen er full eller spilleren allerede står i troppen (se 0054).

create table if not exists public.special_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  options uuid[] not null check (cardinality(options) between 1 and 5),
  chosen_special_card uuid references public.special_cards(id),
  chosen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists special_picks_pending_idx on public.special_picks(user_id) where chosen_at is null;
alter table public.special_picks enable row level security;
grant all on public.special_picks to service_role;

-- Trekker fem spesialkort av ulike spillere og lagrer dem som et ventende valg. Returnerer id-en til valget.
create or replace function public.create_special_pick(target_user uuid)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  honorable_count integer := floor(random() * 6)::integer;
  wanted text;
  picked uuid;
  excluded uuid[] := '{}';
  chosen uuid[] := '{}';
  pick_id uuid;
begin
  for slot_index in 1..5 loop
    wanted := case when slot_index <= honorable_count then 'honorable' else 'informs' end;
    picked := public.draw_special_card(wanted, excluded);
    -- Er en type tom (eller tom for nye spillere), brukes den andre typen.
    if picked is null then picked := public.draw_special_card(case when wanted = 'honorable' then 'informs' else 'honorable' end, excluded); end if;
    exit when picked is null;
    chosen := chosen || picked;
    -- Alle spesialkort av samme spiller holdes utenfor resten av trekningen.
    excluded := excluded || array(select id from special_cards where catalog_id = (select catalog_id from special_cards where id = picked));
  end loop;
  if cardinality(chosen) = 0 then raise exception 'Det finnes ingen spesialkort å trekke ennå'; end if;
  insert into special_picks (user_id, options)
  values (target_user, array(select option from unnest(chosen) as option order by random()))
  returning id into pick_id;
  return pick_id;
end;
$fn$;

-- Velger ett av de fem kortene. Kortet blir et vanlig kort i klubben. Et valg kan bare brukes én gang.
create or replace function public.claim_special_pick(target_user uuid, target_pick uuid, target_card uuid)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  pick_row special_picks%rowtype;
  special_row special_cards%rowtype;
  card_row player_catalog%rowtype;
  free_squad integer;
  slot text;
  new_card_id uuid;
  was_owned boolean;
begin
  perform 1 from player_profiles where user_id = target_user for update;
  if not found then raise exception 'Fant ikke managerprofilen'; end if;
  select * into pick_row from special_picks where id = target_pick and user_id = target_user for update;
  if not found then raise exception 'Fant ikke spillervalget'; end if;
  if pick_row.chosen_at is not null then raise exception 'Du har allerede valgt et kort her'; end if;
  if target_card <> all(pick_row.options) then raise exception 'Kortet er ikke blant de fem'; end if;
  select * into special_row from special_cards where id = target_card;
  select * into card_row from player_catalog where id = special_row.catalog_id;
  if card_row.id is null then raise exception 'Fant ikke kortet'; end if;

  free_squad := public.manager_squad_capacity() - (select count(*) from manager_cards where owner_id = target_user and location = 'squad');
  was_owned := exists (select 1 from manager_cards where owner_id = target_user and catalog_id = card_row.id and special_card_id = special_row.id);
  slot := case when free_squad > 0 then 'squad' else 'storage' end;
  -- Triggeren sender kortet til lageret hvis spilleren allerede er i troppen, så plassen leses tilbake fra raden.
  insert into manager_cards (owner_id, catalog_id, name, position, overall, attributes, acquired_price, location, special_card_id, tradable)
  values (target_user, card_row.id, card_row.name, card_row.position, special_row.overall, coalesce(special_row.attributes, card_row.attributes),
    coalesce(special_row.price, card_row.price), slot, special_row.id, true)
  returning id, location into new_card_id, slot;

  update special_picks set chosen_special_card = target_card, chosen_at = now() where id = pick_row.id;
  return jsonb_build_object(
    'card_id', new_card_id, 'catalog_id', card_row.id, 'slug', card_row.slug, 'name', card_row.name,
    'position', card_row.position, 'overall', special_row.overall, 'price', coalesce(special_row.price, card_row.price),
    'accent', card_row.accent, 'club', card_row.club, 'attributes', coalesce(special_row.attributes, card_row.attributes),
    'location', slot, 'special', special_row.kind, 'tradable', true, 'duplicate', was_owned);
end;
$fn$;

revoke all on function public.create_special_pick(uuid) from public, anon, authenticated;
revoke all on function public.claim_special_pick(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_special_pick(uuid) to service_role;
grant execute on function public.claim_special_pick(uuid, uuid, uuid) to service_role;

-- Gi alle som har en managerprofil et spillervalg.
select public.create_special_pick(user_id) from player_profiles;
