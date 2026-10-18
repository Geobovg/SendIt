-- Stadion: bygninger som oppgraderes med MB og tid, som i Clash of Clans (se docs/adr/0004-stadion.md).
-- Tre bygninger: klubbhus (setter taket for de andre), billettluke (gir MB i timen) og tribune (hjemmebanebonus).
-- Kostnader, byggetider og inntekt ligger i src/lib/stadium.ts. Funksjonene her får dem fra serverkoden og passer på
-- det som må være atomisk: pengene, byggerne og at nivåene tas i riktig rekkefølge.
-- Ingen rad i stadium_buildings betyr startnivået (klubbhus 1, billettluke 1, tribune 0).

alter table player_profiles add column stadium_collected_at timestamptz not null default now();

create table stadium_buildings (
  user_id uuid not null references player_profiles(user_id) on delete cascade,
  building text not null check (building in ('klubbhus', 'billettluke', 'tribune')),
  level integer not null check (level between 0 and 10),
  upgrade_to integer check (upgrade_to between 1 and 10),
  upgrade_ends_at timestamptz,
  primary key (user_id, building),
  check ((upgrade_to is null) = (upgrade_ends_at is null))
);
alter table stadium_buildings enable row level security;
grant all on stadium_buildings to service_role;

-- Starter en oppgradering. Svarer {ok: true, ends_at} eller {ok: false, reason}: no_profile, stale, busy, builders_busy,
-- klubbhus_low, no_money eller invalid. Rekkefølgen på sjekkene bestemmer hvilken grunn brukeren ser.
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
  finish timestamptz;
begin
  if target_building not in ('klubbhus', 'billettluke', 'tribune') or target_level < 1 or upgrade_cost < 0 or upgrade_seconds < 1 or builder_count < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Profilraden låses først, så to oppgraderinger samtidig står i kø i stedet for å begge slippe gjennom.
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;

  -- Ferdige oppgraderinger blir utført.
  update stadium_buildings set level = upgrade_to, upgrade_to = null, upgrade_ends_at = null
  where user_id = target_user and upgrade_ends_at <= clock_timestamp();

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

  finish := clock_timestamp() + make_interval(secs => upgrade_seconds);
  update player_profiles set manager_budget = manager_budget - upgrade_cost, updated_at = now() where user_id = target_user;
  insert into stadium_buildings (user_id, building, level, upgrade_to, upgrade_ends_at)
  values (target_user, target_building, target_level - 1, target_level, finish)
  on conflict (user_id, building) do update set upgrade_to = excluded.upgrade_to, upgrade_ends_at = excluded.upgrade_ends_at;
  return jsonb_build_object('ok', true, 'ends_at', finish);
end;
$fn$;

-- Tømmer billettluka: MB som har samlet seg siden sist, aldri mer enn kapasiteten. Klokka starter på nytt, så tiden
-- billettluka sto full er tapt, som i Clash. Under 1 MB gir {ok: false, reason: 'nothing'} og rører ingenting.
create or replace function public.stadium_collect(target_user uuid, hourly_rate numeric, capacity integer)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  profile_row player_profiles%rowtype;
  hours numeric;
  paid integer;
begin
  if hourly_rate < 0 or capacity < 0 then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  hours := greatest(0, extract(epoch from (clock_timestamp() - profile_row.stadium_collected_at)) / 3600.0);
  paid := least(capacity, floor(hourly_rate * hours))::integer;
  if paid < 1 then return jsonb_build_object('ok', false, 'reason', 'nothing'); end if;
  update player_profiles
  set manager_budget = manager_budget + paid, manager_budget_earned = manager_budget_earned + paid,
      stadium_collected_at = clock_timestamp(), updated_at = now()
  where user_id = target_user;
  return jsonb_build_object('ok', true, 'amount', paid);
end;
$fn$;

revoke all on function public.stadium_start_upgrade(uuid, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.stadium_collect(uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.stadium_start_upgrade(uuid, text, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.stadium_collect(uuid, numeric, integer) to service_role;
