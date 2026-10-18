-- Stadion: bygninger som oppgraderes med MB og tid, som i Clash of Clans (se docs/adr/0004-stadion.md).
-- Alle starter likt, uansett arena, divisjon og klubbnivå. Syv bygninger: klubbhus (taket for de andre og flere byggere),
-- billettluke (gruve som gir MB), kasse (lager), treningsfelt (klubb-XP), tribune (mer fra billettluka), supporterfelt
-- (raskere bygging) og speiderhytte (en speider kommer hjem med en pakke eller en spiller du kan kjøpe).
-- Kostnader, byggetider, inntekt og hva speideren finner ligger i src/lib/stadium.ts. Funksjonene her får dem fra
-- serverkoden og passer på det som må være atomisk: pengene, byggerne og at nivåene tas i rekkefølge.
-- Ingen rad i stadium_buildings betyr startnivået (klubbhus 1, billettluke 1, kasse 1, de andre 0).

alter table player_profiles add column stadium_collected_at timestamptz not null default now();
alter table player_profiles add column stadium_xp_collected_at timestamptz not null default now();

create table stadium_buildings (
  user_id uuid not null references player_profiles(user_id) on delete cascade,
  building text not null check (building in ('klubbhus', 'billettluke', 'kasse', 'treningsfelt', 'tribune', 'supporterfelt', 'speiderhytte')),
  level integer not null check (level between 0 and 10),
  upgrade_to integer check (upgrade_to between 1 and 10),
  upgrade_started_at timestamptz,
  upgrade_ends_at timestamptz,
  primary key (user_id, building),
  check ((upgrade_to is null) = (upgrade_ends_at is null) and (upgrade_to is null) = (upgrade_started_at is null))
);
alter table stadium_buildings enable row level security;
grant all on stadium_buildings to service_role;

-- Én speider om gangen. Raden blir stående til manageren har valgt mellom pakken og spilleren.
-- offer settes første gang manageren åpner den etter at speideren er hjemme: {pack_key, player: {…} | null}.
create table stadium_scouts (
  user_id uuid primary key references player_profiles(user_id) on delete cascade,
  level integer not null check (level between 1 and 10),
  started_at timestamptz not null,
  ends_at timestamptz not null,
  offer jsonb
);
alter table stadium_scouts enable row level security;
grant all on stadium_scouts to service_role;

-- Ferdige oppgraderinger blir utført. Kalles av alle funksjonene under, etter at profilraden er låst.
create or replace function public.stadium_settle(target_user uuid)
returns void
language sql
set search_path = public, pg_temp
as $fn$
  update stadium_buildings set level = upgrade_to, upgrade_to = null, upgrade_started_at = null, upgrade_ends_at = null
  where user_id = target_user and upgrade_ends_at <= clock_timestamp();
$fn$;

-- Starter en oppgradering. Svarer {ok: true, ends_at} eller {ok: false, reason}: no_profile, stale, busy, builders_busy,
-- klubbhus_low, no_money eller invalid. Rekkefølgen på sjekkene bestemmer hvilken grunn brukeren ser.
-- Treningsfeltet begynner å samle XP når det står ferdig, ikke fra migreringen.
create or replace function public.stadium_start_upgrade(
  target_user uuid, target_building text, target_level integer, upgrade_cost integer, upgrade_seconds integer, builder_count integer, min_klubbhus integer
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  profile_row player_profiles%rowtype;
  building_row stadium_buildings%rowtype;
  klubbhus_level integer;
  running integer;
  started timestamptz := clock_timestamp();
  finish timestamptz;
begin
  if target_building not in ('klubbhus', 'billettluke', 'kasse', 'treningsfelt', 'tribune', 'supporterfelt', 'speiderhytte')
    or target_level < 1 or target_level > 10 or upgrade_cost < 0 or upgrade_seconds < 1 or builder_count < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Profilraden låses først, så to oppgraderinger samtidig står i kø i stedet for å begge slippe gjennom.
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;

  perform public.stadium_settle(target_user);

  select * into building_row from stadium_buildings where user_id = target_user and building = target_building;
  if found then
    if building_row.upgrade_to is not null then return jsonb_build_object('ok', false, 'reason', 'busy'); end if;
    if building_row.level <> target_level - 1 then return jsonb_build_object('ok', false, 'reason', 'stale'); end if;
  end if;

  select count(*) into running from stadium_buildings where user_id = target_user and upgrade_to is not null;
  if running >= builder_count then return jsonb_build_object('ok', false, 'reason', 'builders_busy'); end if;

  select coalesce((select level from stadium_buildings where user_id = target_user and building = 'klubbhus'), 1) into klubbhus_level;
  if klubbhus_level < min_klubbhus then return jsonb_build_object('ok', false, 'reason', 'klubbhus_low'); end if;

  if profile_row.manager_budget < upgrade_cost then return jsonb_build_object('ok', false, 'reason', 'no_money'); end if;

  finish := started + make_interval(secs => upgrade_seconds);
  update player_profiles set manager_budget = manager_budget - upgrade_cost, updated_at = now() where user_id = target_user;
  if target_building = 'treningsfelt' and target_level = 1 then
    update player_profiles set stadium_xp_collected_at = finish where user_id = target_user;
  end if;
  insert into stadium_buildings (user_id, building, level, upgrade_to, upgrade_started_at, upgrade_ends_at)
  values (target_user, target_building, target_level - 1, target_level, started, finish)
  on conflict (user_id, building) do update set upgrade_to = excluded.upgrade_to, upgrade_started_at = excluded.upgrade_started_at, upgrade_ends_at = excluded.upgrade_ends_at;
  return jsonb_build_object('ok', true, 'ends_at', finish);
end;
$fn$;

-- Gjør en pågående oppgradering ferdig nå, mot MB: mb_per_hour for hver time som er igjen, og gratis de siste
-- free_seconds. Prisen regnes ut her fra tiden som faktisk er igjen. Svarer {ok: true, cost} eller {ok: false, reason}:
-- no_profile, not_building, no_money eller invalid.
create or replace function public.stadium_speedup(target_user uuid, target_building text, mb_per_hour numeric, free_seconds integer)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  profile_row player_profiles%rowtype;
  building_row stadium_buildings%rowtype;
  remaining numeric;
  price integer;
  now_ts timestamptz := clock_timestamp();
begin
  if mb_per_hour < 0 or free_seconds < 0 then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;

  select * into building_row from stadium_buildings
  where user_id = target_user and building = target_building and upgrade_to is not null and upgrade_ends_at > now_ts;
  if not found then
    perform public.stadium_settle(target_user);
    return jsonb_build_object('ok', false, 'reason', 'not_building');
  end if;

  remaining := extract(epoch from (building_row.upgrade_ends_at - now_ts));
  price := case when remaining <= free_seconds then 0 else ceil(remaining / 3600.0 * mb_per_hour)::integer end;
  if profile_row.manager_budget < price then return jsonb_build_object('ok', false, 'reason', 'no_money'); end if;

  if price > 0 then
    update player_profiles set manager_budget = manager_budget - price, updated_at = now() where user_id = target_user;
  end if;
  update stadium_buildings set level = upgrade_to, upgrade_to = null, upgrade_started_at = null, upgrade_ends_at = null
  where user_id = target_user and building = target_building;
  perform public.stadium_settle(target_user);
  if target_building = 'treningsfelt' and building_row.upgrade_to = 1 then
    update player_profiles set stadium_xp_collected_at = now_ts where user_id = target_user;
  end if;
  return jsonb_build_object('ok', true, 'cost', price);
end;
$fn$;

-- Tømmer billettluka (collector = 'mb') eller treningsfeltet ('xp'): det som har samlet seg siden sist, aldri mer enn
-- kapasiteten. Klokka starter på nytt, så tiden lageret sto fullt er tapt, som i Clash. Under 1 gir
-- {ok: false, reason: 'nothing'} og rører ingenting. MB regnes også som inntekt; XP går til klubbnivået.
create or replace function public.stadium_collect(target_user uuid, collector text, hourly_rate numeric, capacity integer)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  profile_row player_profiles%rowtype;
  since timestamptz;
  hours numeric;
  paid integer;
begin
  if collector not in ('mb', 'xp') or hourly_rate < 0 or capacity < 0 then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  since := case collector when 'mb' then profile_row.stadium_collected_at else profile_row.stadium_xp_collected_at end;
  hours := greatest(0, extract(epoch from (clock_timestamp() - since)) / 3600.0);
  paid := least(capacity, floor(hourly_rate * hours))::integer;
  if paid < 1 then return jsonb_build_object('ok', false, 'reason', 'nothing'); end if;
  if collector = 'mb' then
    update player_profiles
    set manager_budget = manager_budget + paid, manager_budget_earned = manager_budget_earned + paid,
        stadium_collected_at = clock_timestamp(), updated_at = now()
    where user_id = target_user;
  else
    update player_profiles set stadium_xp_collected_at = clock_timestamp(), updated_at = now() where user_id = target_user;
    perform public.grant_club_xp(target_user, paid);
  end if;
  return jsonb_build_object('ok', true, 'amount', paid);
end;
$fn$;

-- Sender ut en speider. Svarer {ok: true, ends_at} eller {ok: false, reason}: scout_busy (forrige speider er ikke
-- ferdig behandlet), no_profile eller invalid.
create or replace function public.stadium_scout_send(target_user uuid, scout_level integer, mission_seconds integer)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  finish timestamptz;
begin
  if scout_level < 1 or scout_level > 10 or mission_seconds < 1 then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  perform 1 from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if exists (select 1 from stadium_scouts where user_id = target_user) then return jsonb_build_object('ok', false, 'reason', 'scout_busy'); end if;
  finish := clock_timestamp() + make_interval(secs => mission_seconds);
  insert into stadium_scouts (user_id, level, started_at, ends_at) values (target_user, scout_level, clock_timestamp(), finish);
  return jsonb_build_object('ok', true, 'ends_at', finish);
end;
$fn$;

-- Åpner det speideren kom hjem med: en tilfeldig spiller blant de aktive i katalogen mellom min_overall og max_overall
-- som manageren ikke eier fra før, og en pakke. Valget lagres, så det står fast til manageren har bestemt seg.
-- Prisen er price_factor av katalogprisen. Svarer {ok: true, offer} eller {ok: false, reason}: no_profile, no_scout,
-- scout_away eller invalid. Finnes det ingen spiller som passer, er player null og bare pakken kan velges.
create or replace function public.stadium_scout_reveal(target_user uuid, min_overall integer, max_overall integer, pack_key text, price_factor numeric)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  scout_row stadium_scouts%rowtype;
  pick player_catalog%rowtype;
  next_offer jsonb;
begin
  if min_overall > max_overall or price_factor <= 0 or pack_key is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  perform 1 from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into scout_row from stadium_scouts where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_scout'); end if;
  if scout_row.ends_at > clock_timestamp() then return jsonb_build_object('ok', false, 'reason', 'scout_away'); end if;
  if scout_row.offer is not null then return jsonb_build_object('ok', true, 'offer', scout_row.offer); end if;

  select * into pick from player_catalog catalog
  where catalog.active and catalog.overall between min_overall and max_overall
    and not exists (select 1 from manager_cards card where card.owner_id = target_user and card.catalog_id = catalog.id and card.special_card_id is null)
  order by random() limit 1;
  next_offer := jsonb_build_object('pack_key', pack_key, 'player', case when pick.id is null then null else jsonb_build_object(
    'catalog_id', pick.id, 'slug', pick.slug, 'name', pick.name, 'position', pick.position, 'overall', pick.overall,
    'club', pick.club, 'accent', pick.accent, 'attributes', pick.attributes, 'price', greatest(1, round(pick.price * price_factor))::integer) end);
  update stadium_scouts set offer = next_offer where user_id = target_user;
  return jsonb_build_object('ok', true, 'offer', next_offer);
end;
$fn$;

-- Manageren velger: choice = 'pack' legger pakken i gratispakkene, 'player' kjøper spilleren til tilbudsprisen og legger
-- kortet i troppen eller lageret. Begge avslutter oppdraget. Svarer {ok: true, kind, …} eller {ok: false, reason}:
-- no_profile, no_offer, scout_away, owned, no_money, no_room eller invalid.
create or replace function public.stadium_scout_choose(target_user uuid, choice text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  profile_row player_profiles%rowtype;
  scout_row stadium_scouts%rowtype;
  catalog_row player_catalog%rowtype;
  offered jsonb;
  price integer;
  slot text;
  new_card_id uuid;
begin
  if choice not in ('pack', 'player') then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into scout_row from stadium_scouts where user_id = target_user for update;
  if not found or scout_row.offer is null then return jsonb_build_object('ok', false, 'reason', 'no_offer'); end if;
  if scout_row.ends_at > clock_timestamp() then return jsonb_build_object('ok', false, 'reason', 'scout_away'); end if;

  if choice = 'pack' then
    perform public.grant_pack(target_user, scout_row.offer->>'pack_key', 1);
    delete from stadium_scouts where user_id = target_user;
    return jsonb_build_object('ok', true, 'kind', 'pack', 'pack_key', scout_row.offer->>'pack_key');
  end if;

  offered := scout_row.offer->'player';
  if offered is null or jsonb_typeof(offered) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'no_offer'); end if;
  select * into catalog_row from player_catalog where id = (offered->>'catalog_id')::uuid and active for share;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_offer'); end if;
  if exists (select 1 from manager_cards where owner_id = target_user and catalog_id = catalog_row.id and special_card_id is null) then
    return jsonb_build_object('ok', false, 'reason', 'owned');
  end if;
  price := (offered->>'price')::integer;
  if profile_row.manager_budget < price then return jsonb_build_object('ok', false, 'reason', 'no_money'); end if;
  slot := public.next_card_location(target_user);
  if slot is null then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;

  update player_profiles set manager_budget = manager_budget - price, updated_at = now() where user_id = target_user;
  insert into manager_cards (owner_id, catalog_id, name, position, overall, attributes, acquired_price, location)
  values (target_user, catalog_row.id, catalog_row.name, catalog_row.position, catalog_row.overall, catalog_row.attributes, catalog_row.price, slot)
  returning id into new_card_id;
  delete from stadium_scouts where user_id = target_user;
  return jsonb_build_object('ok', true, 'kind', 'player', 'card_id', new_card_id);
end;
$fn$;

revoke all on function public.stadium_settle(uuid) from public, anon, authenticated;
revoke all on function public.stadium_start_upgrade(uuid, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.stadium_speedup(uuid, text, numeric, integer) from public, anon, authenticated;
revoke all on function public.stadium_collect(uuid, text, numeric, integer) from public, anon, authenticated;
revoke all on function public.stadium_scout_send(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.stadium_scout_reveal(uuid, integer, integer, text, numeric) from public, anon, authenticated;
revoke all on function public.stadium_scout_choose(uuid, text) from public, anon, authenticated;
grant execute on function public.stadium_start_upgrade(uuid, text, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.stadium_speedup(uuid, text, numeric, integer) to service_role;
grant execute on function public.stadium_collect(uuid, text, numeric, integer) to service_role;
grant execute on function public.stadium_scout_send(uuid, integer, integer) to service_role;
grant execute on function public.stadium_scout_reveal(uuid, integer, integer, text, numeric) to service_role;
grant execute on function public.stadium_scout_choose(uuid, text) to service_role;
