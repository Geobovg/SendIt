-- Brødrestevnet brooor: en gratis eventpakke til alle managere som logger inn til og med søndag 18. oktober.
-- Pakken ligger klar i butikken (manager_pack_inventory) og åpnes når manageren vil. Den gir ett tilfeldig
-- spesialkort (inform eller honorable mention) og et spillervalg: fem vanlige spillere på 83+, hvorav man velger én.
-- * Pakken kan ikke kjøpes og har ikke noe tidsvindu selv, så en uåpnet pakke ikke forsvinner søndag kveld.
--   Fristen ligger i event_gifts: bare de som logger inn før den, får pakken, og hver bare én gang.
-- * Spillervalget (player_picks) lages når pakken åpnes. Det er som Spillervalget fra 0102, men med vanlige spillere.

-- 1) Spesialkortet trekkes med scope 'mix': like stor sjanse for inform og honorable mention, og den andre typen hvis
-- den ene er tom. Den gamle draw_special_card (0088) får nytt navn og kalles videre for alle andre scope. Skal den
-- skrives om senere, må 'mix' tas med i den nye versjonen.
alter table manager_packs drop constraint if exists manager_packs_special_scope_check;
alter table manager_packs add constraint manager_packs_special_scope_check check (special_scope in ('current', 'all', 'tots', 'mix'));

alter function public.draw_special_card(text, uuid[]) rename to draw_special_card_base;

create or replace function public.draw_special_card(scope text, excluded uuid[])
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  first_scope text := case when random() < 0.5 then 'honorable' else 'informs' end;
  picked uuid;
begin
  if scope <> 'mix' then return public.draw_special_card_base(scope, excluded); end if;
  picked := public.draw_special_card_base(first_scope, excluded);
  if picked is null then picked := public.draw_special_card_base(case when first_scope = 'honorable' then 'informs' else 'honorable' end, excluded); end if;
  return picked;
end;
$fn$;

revoke all on function public.draw_special_card(text, uuid[]) from public, anon, authenticated;
revoke all on function public.draw_special_card_base(text, uuid[]) from public, anon, authenticated;
grant execute on function public.draw_special_card(text, uuid[]) to service_role;
grant execute on function public.draw_special_card_base(text, uuid[]) to service_role;

-- 2) Pakken. Ett kort, og det er spesialkortet. Oddsen brukes ikke (ingen vanlige kort trekkes), men må finnes.
insert into manager_packs (key, name, description, price, card_count, guarantee_min, guarantee_count, guarantees, odds, accent, sort_order,
  inform_chance, tots_chance, icon_chance, honorable_chance, special_guarantee, special_scope, purchasable, active) values
  ('brodrestevnet_brooor', 'Brødrestevnet brooor', 'Ett spesialkort (inform eller honorable mention) og et spillervalg: fem spillere på 83+, du velger én.',
    0, 1, 83, 1, '[]', '[{"min":83,"max":99,"weight":1}]', '#ff8a1f', 0, 0, 0, 0, 0, 1, 'mix', false, true)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price = excluded.price, card_count = excluded.card_count,
  guarantee_min = excluded.guarantee_min, guarantee_count = excluded.guarantee_count, guarantees = excluded.guarantees, odds = excluded.odds,
  accent = excluded.accent, sort_order = excluded.sort_order, inform_chance = excluded.inform_chance, tots_chance = excluded.tots_chance,
  icon_chance = excluded.icon_chance, honorable_chance = excluded.honorable_chance, special_guarantee = excluded.special_guarantee,
  special_scope = excluded.special_scope, purchasable = excluded.purchasable, active = excluded.active;

-- 3) Gaver som deles ut til alle som logger inn før fristen. Ny gave: legg en rad i event_gifts.
create table if not exists public.event_gifts (
  key text primary key,
  pack_key text not null references public.manager_packs(key),
  available_until timestamptz not null
);
create table if not exists public.event_gift_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gift_key text not null references public.event_gifts(key),
  claimed_at timestamptz not null default now(),
  primary key (user_id, gift_key)
);
alter table public.event_gifts enable row level security;
alter table public.event_gift_claims enable row level security;
grant all on public.event_gifts to service_role;
grant all on public.event_gift_claims to service_role;

-- Fristen er slutten av søndagen, norsk tid.
insert into event_gifts (key, pack_key, available_until)
values ('brodrestevnet_brooor', 'brodrestevnet_brooor', timestamp '2026-10-19 00:00' at time zone 'Europe/Oslo')
on conflict (key) do nothing;

-- Henter gavene som er åpne nå og som manageren ikke har fått ennå. Trygt å kalle på hver innlogging: primærnøkkelen
-- sørger for at hver gave bare deles ut én gang, selv om to sider lastes samtidig. Returnerer antall nye gaver.
create or replace function public.claim_event_gifts(target_user uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  gift event_gifts%rowtype;
  inserted integer;
  granted integer := 0;
begin
  perform 1 from player_profiles where user_id = target_user;
  if not found then return 0; end if;
  for gift in select * from event_gifts where now() < available_until loop
    insert into event_gift_claims (user_id, gift_key) values (target_user, gift.key) on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted > 0 then
      perform public.grant_pack(target_user, gift.pack_key, 1);
      granted := granted + 1;
    end if;
  end loop;
  return granted;
end;
$fn$;

-- 4) Spillervalg med vanlige spillere: options er id-er i player_catalog.
create table if not exists public.player_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  options uuid[] not null check (cardinality(options) between 1 and 5),
  chosen_catalog uuid references public.player_catalog(id),
  chosen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists player_picks_pending_idx on public.player_picks(user_id) where chosen_at is null;
alter table public.player_picks enable row level security;
grant all on public.player_picks to service_role;

-- Trekker fem ulike spillere på min_overall eller bedre og lagrer dem som et ventende valg. Spillere manageren
-- allerede har som vanlig kort, utelates, så langt det er nok igjen. Returnerer id-en til valget.
create or replace function public.create_player_pick(target_user uuid, min_overall integer, option_count integer)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  chosen uuid[];
  pick_id uuid;
begin
  chosen := array(
    select id from player_catalog
    where active and overall >= min_overall
      and id not in (select catalog_id from manager_cards where owner_id = target_user and catalog_id is not null and special_card_id is null)
    order by random() limit option_count);
  if cardinality(chosen) < option_count then
    chosen := array(select id from player_catalog where active and overall >= min_overall order by random() limit option_count);
  end if;
  if cardinality(chosen) = 0 then raise exception 'Katalogen har ikke nok kort til denne pakken'; end if;
  insert into player_picks (user_id, options) values (target_user, chosen) returning id into pick_id;
  return pick_id;
end;
$fn$;

-- Velger én av spillerne. Kortet blir et vanlig kort i klubben, i troppen eller på lageret hvis troppen er full
-- eller spilleren allerede står i troppen (se 0054). Et valg kan bare brukes én gang.
create or replace function public.claim_player_pick(target_user uuid, target_pick uuid, target_catalog uuid)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  pick_row player_picks%rowtype;
  card_row player_catalog%rowtype;
  free_squad integer;
  slot text;
  new_card_id uuid;
  was_owned boolean;
begin
  perform 1 from player_profiles where user_id = target_user for update;
  if not found then raise exception 'Fant ikke managerprofilen'; end if;
  select * into pick_row from player_picks where id = target_pick and user_id = target_user for update;
  if not found then raise exception 'Fant ikke spillervalget'; end if;
  if pick_row.chosen_at is not null then raise exception 'Du har allerede valgt et kort her'; end if;
  if target_catalog <> all(pick_row.options) then raise exception 'Kortet er ikke blant de fem'; end if;
  select * into card_row from player_catalog where id = target_catalog;
  if card_row.id is null then raise exception 'Fant ikke kortet'; end if;

  free_squad := public.manager_squad_capacity() - (select count(*) from manager_cards where owner_id = target_user and location = 'squad');
  was_owned := exists (select 1 from manager_cards where owner_id = target_user and catalog_id = card_row.id and special_card_id is null);
  slot := case when free_squad > 0 then 'squad' else 'storage' end;
  -- Triggeren sender kortet til lageret hvis spilleren allerede er i troppen, så plassen leses tilbake fra raden.
  insert into manager_cards (owner_id, catalog_id, name, position, overall, attributes, acquired_price, location, special_card_id, tradable)
  values (target_user, card_row.id, card_row.name, card_row.position, card_row.overall, card_row.attributes, card_row.price, slot, null, true)
  returning id, location into new_card_id, slot;

  update player_picks set chosen_catalog = target_catalog, chosen_at = now() where id = pick_row.id;
  return jsonb_build_object(
    'card_id', new_card_id, 'catalog_id', card_row.id, 'slug', card_row.slug, 'name', card_row.name,
    'position', card_row.position, 'overall', card_row.overall, 'price', card_row.price,
    'accent', card_row.accent, 'club', card_row.club, 'attributes', card_row.attributes,
    'location', slot, 'special', null, 'tradable', true, 'duplicate', was_owned);
end;
$fn$;

-- 5) Gratispakker åpnes som før (0060), men Brødrestevnet brooor lager også spillervalget. Går åpningen i stykker
-- (for eksempel fordi det ikke er plass til kortet), rulles alt tilbake, også pakken i lageret.
create or replace function public.open_free_manager_pack(target_user uuid, target_pack text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  pulls jsonb;
begin
  update manager_pack_inventory
  set quantity = quantity - 1, updated_at = now()
  where user_id = target_user and pack_key = target_pack and quantity > 0;
  if not found then raise exception 'Du har ingen gratis pakker av denne typen'; end if;
  pulls := public.deliver_manager_pack(target_user, target_pack, false);
  if target_pack = 'brodrestevnet_brooor' then perform public.create_player_pick(target_user, 83, 5); end if;
  return pulls;
end;
$fn$;

revoke all on function public.claim_event_gifts(uuid) from public, anon, authenticated;
revoke all on function public.create_player_pick(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_player_pick(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.open_free_manager_pack(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_event_gifts(uuid) to service_role;
grant execute on function public.create_player_pick(uuid, integer, integer) to service_role;
grant execute on function public.claim_player_pick(uuid, uuid, uuid) to service_role;
grant execute on function public.open_free_manager_pack(uuid, text) to service_role;
