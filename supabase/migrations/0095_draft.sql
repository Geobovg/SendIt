-- Draft i managerkarrieren, som i FC: du betaler en innsats, drafter et lag fra hele katalogen (kaptein,
-- ellever, benk og reserver) og spiller en utslagsturnering med lagets spillere. Kortene er bare lånt
-- til turneringen og havner aldri i klubben din.
--
-- To varianter:
--   * Solo: fem kamper mot AI-lag som blir bedre for hver runde. Taper du, er du ute.
--   * Venneturnering: én vert inviterer venner, alle drafter samtidig, og så spilles en bracket med
--     åtte lag (tomme plasser fylles med AI-lag). Tre runder: kvartfinale, semifinale og finale.
--
-- Premien avhenger av hvor mange kamper du vant (se draft_prize under og DRAFT_PRIZES i src/lib/draft-core.ts).
-- Draftkampene gir ikke den vanlige kamppremien (MB/XP per kamp) og teller ikke i kamprekorden.

create table if not exists career_draft_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'playing', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists career_draft_rooms_host_idx on career_draft_rooms(host_id, created_at desc);

create table if not exists career_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  room_id uuid references career_draft_rooms(id) on delete cascade,
  status text not null default 'drafting' check (status in ('drafting', 'active', 'eliminated', 'champion', 'cancelled')),
  formation text,
  -- Alternativene som er trukket per plass (kaptein, s0–s10, b0–b6, r0–r4). Lagres så de ikke kan trekkes på nytt.
  offers jsonb not null default '{}'::jsonb,
  -- Spillerne som er valgt, per plass. Samme nøkler som over (uten kaptein).
  players jsonb not null default '{}'::jsonb,
  captain_id text,
  wins integer not null default 0,
  entry_fee integer not null check (entry_fee >= 0),
  reward_mb integer,
  reward_pack text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
-- Hvert lagret valg får en unik, stigende versjon også ved to oppdateringer samme millisekund.
create or replace function public.touch_career_draft()
returns trigger language plpgsql set search_path = public, pg_temp
as $fn$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$fn$;
create trigger touch_career_draft before update on career_drafts
for each row execute function public.touch_career_draft();
revoke all on function public.touch_career_draft() from public, anon, authenticated;

create index if not exists career_drafts_user_idx on career_drafts(user_id, created_at desc);
create index if not exists career_drafts_room_idx on career_drafts(room_id);
-- Én draft om gangen per manager, solo eller i en venneturnering.
create unique index if not exists career_drafts_one_running on career_drafts(user_id) where status in ('drafting', 'active');

create table if not exists career_draft_room_members (
  room_id uuid not null references career_draft_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined')),
  draft_id uuid references career_drafts(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (room_id, user_id)
);
create index if not exists career_draft_room_members_user_idx on career_draft_room_members(user_id, status);

-- Kampene i turneringen. Solo: én per runde, alltid draften din hjemme mot et AI-lag.
-- Venneturnering: `slot` er plassen i runden (0–3 i kvartfinalen), og vinneren går videre til slot / 2.
-- En side er enten en draft (en manager) eller et AI-lag lagret som jsonb: { name, rating, team }.
create table if not exists career_draft_fixtures (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references career_drafts(id) on delete cascade,
  room_id uuid references career_draft_rooms(id) on delete cascade,
  round integer not null check (round between 1 and 5),
  slot integer not null default 0 check (slot >= 0),
  home_draft_id uuid references career_drafts(id) on delete cascade,
  away_draft_id uuid references career_drafts(id) on delete cascade,
  home_ai jsonb,
  away_ai jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'scheduled', 'live', 'completed')),
  match_id uuid unique references career_matches(id) on delete set null,
  home_score integer,
  away_score integer,
  home_penalties integer,
  away_penalties integer,
  winner text check (winner in ('home', 'away')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((draft_id is null) <> (room_id is null)),
  check (home_draft_id is null or home_ai is null),
  check (away_draft_id is null or away_ai is null),
  unique (draft_id, round),
  unique (room_id, round, slot)
);
create index if not exists career_draft_fixtures_home_idx on career_draft_fixtures(home_draft_id);
create index if not exists career_draft_fixtures_away_idx on career_draft_fixtures(away_draft_id);

alter table career_draft_rooms enable row level security;
alter table career_drafts enable row level security;
alter table career_draft_room_members enable row level security;
alter table career_draft_fixtures enable row level security;

-- Disse tabellene brukes bare fra autentiserte serverhandlinger med service_role.
grant all on career_draft_rooms, career_drafts, career_draft_room_members, career_draft_fixtures to service_role;

-- Premien logges i samme ledger som resten av belønningene.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'career_reward_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%source_type%'
  loop
    execute format('alter table career_reward_events drop constraint %I', constraint_name);
  end loop;
end $$;
alter table career_reward_events add constraint career_reward_events_source_type_check check (source_type in (
  'starter', 'tournament_match', 'tournament_champion', 'tournament_finalist', 'career_match', 'market_sale', 'club_level', 'ai_season', 'friend_season', 'sbc', 'draft'
));

-- Innsatsen. Holdes lik DRAFT_ENTRY_FEE i src/lib/draft-core.ts.
create or replace function public.draft_entry_fee()
returns integer language sql immutable set search_path = public, pg_temp
as $fn$ select 50 $fn$;

-- Starter en draft: trekker innsatsen og lager draften. Med `target_room` blir manageren med i venneturneringen.
create or replace function public.start_draft(target_user uuid, target_room uuid default null)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  new_id uuid;
  room_row career_draft_rooms%rowtype;
  fee integer := public.draft_entry_fee();
  existing career_drafts%rowtype;
begin
  if target_room is not null then
    select * into room_row from career_draft_rooms where id = target_room for update;
    if not found or room_row.status <> 'open' then raise exception 'Draft-turneringen har allerede startet'; end if;
    if not exists (select 1 from career_draft_room_members where room_id = target_room and user_id = target_user) then
      raise exception 'Du er ikke invitert til denne draft-turneringen';
    end if;
    if (select count(*) from career_draft_room_members where room_id = target_room and status = 'joined') >= 8 then
      raise exception 'Draft-turneringen er full';
    end if;
  end if;

  select * into existing from career_drafts
  where user_id = target_user and status in ('drafting', 'active');
  if found then
    -- Samme låserekkefølge som kampstart: fixture før draft. Les laget igjen etter låsing.
    perform 1 from career_draft_fixtures where draft_id = existing.id order by id for update;
    select * into existing from career_drafts where id = existing.id for update;
    if existing.status not in ('drafting', 'active') then raise exception 'Du har allerede en draft i gang'; end if;
    if target_room is null or existing.room_id is not null or existing.wins <> 0
      or exists (select 1 from career_draft_fixtures where draft_id = existing.id and status in ('live', 'completed'))
    then raise exception 'Du har allerede en draft i gang'; end if;
    -- Innsatsen er allerede betalt. Laget og de trukne alternativene følger med til rommet.
    delete from career_draft_fixtures where draft_id = existing.id;
    update career_drafts set room_id = target_room, updated_at = clock_timestamp() where id = existing.id;
    update career_draft_room_members set status = 'joined', joined_at = now(), draft_id = existing.id
    where room_id = target_room and user_id = target_user;
    return existing.id;
  end if;

  update player_profiles set manager_budget = manager_budget - fee, updated_at = now()
  where user_id = target_user and manager_budget >= fee;
  if not found then raise exception 'Ikke nok managerbudsjett'; end if;

  insert into career_drafts (user_id, room_id, entry_fee) values (target_user, target_room, fee) returning id into new_id;
  if target_room is not null then
    update career_draft_room_members set status = 'joined', joined_at = now(), draft_id = new_id
    where room_id = target_room and user_id = target_user;
  end if;
  return new_id;
end;
$fn$;

-- Lager en venneturnering med verten som første deltaker og de inviterte vennene.
create or replace function public.create_draft_room(target_user uuid, invited uuid[])
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  new_room uuid;
begin
  insert into career_draft_rooms (host_id) values (target_user) returning id into new_room;
  insert into career_draft_room_members (room_id, user_id) values (new_room, target_user);
  insert into career_draft_room_members (room_id, user_id)
  select new_room, friend from unnest(coalesce(invited, '{}')) as friend where friend <> target_user
  on conflict do nothing;
  perform public.start_draft(target_user, new_room);
  return new_room;
end;
$fn$;

-- Forlater en venneturnering før den har startet, og får innsatsen tilbake. Går verten, avlyses hele turneringen.
create or replace function public.leave_draft_room(target_user uuid, target_room uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  room_row career_draft_rooms%rowtype;
  draft_row career_drafts%rowtype;
begin
  select * into room_row from career_draft_rooms where id = target_room for update;
  if not found or room_row.status <> 'open' then raise exception 'Draft-turneringen har allerede startet'; end if;
  for draft_row in
    select * from career_drafts
    where room_id = target_room and status in ('drafting', 'active') and (room_row.host_id = target_user or user_id = target_user)
    for update
  loop
    update career_drafts set status = 'cancelled', finished_at = now(), updated_at = now() where id = draft_row.id;
    update player_profiles set manager_budget = manager_budget + draft_row.entry_fee, updated_at = now() where user_id = draft_row.user_id;
  end loop;
  if room_row.host_id = target_user then
    update career_draft_rooms set status = 'cancelled', completed_at = now() where id = target_room;
  else
    delete from career_draft_room_members where room_id = target_room and user_id = target_user;
  end if;
end;
$fn$;

-- Premien etter antall seire. Solo har fem runder, venneturneringen tre.
create or replace function public.draft_prize(rounds integer, wins integer, out prize_mb integer, out prize_pack text)
language plpgsql immutable set search_path = public, pg_temp
as $fn$
begin
  if rounds = 5 then
    prize_mb := (array[15, 30, 50, 75, 110, 175])[least(greatest(wins, 0), 5) + 1];
    prize_pack := (array[null, null, null, 'gullpakke', 'premium_gull', 'sjeldne_spillere']::text[])[least(greatest(wins, 0), 5) + 1];
  else
    prize_mb := (array[15, 40, 80, 150])[least(greatest(wins, 0), 3) + 1];
    prize_pack := (array[null, null, 'gullpakke', 'premium_gull']::text[])[least(greatest(wins, 0), 3) + 1];
  end if;
end;
$fn$;

-- Avslutter en draft (ute eller vinner) og deler ut premien én gang.
create or replace function public.finish_draft(target_draft uuid, final_status text)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  draft_row career_drafts%rowtype;
  prize record;
begin
  select * into draft_row from career_drafts where id = target_draft for update;
  if not found or draft_row.status not in ('drafting', 'active') then return; end if;
  if exists (select 1 from career_draft_fixtures where status = 'live' and (home_draft_id = draft_row.id or away_draft_id = draft_row.id)) then
    raise exception 'Vent til draftkampen er ferdig';
  end if;
  select * into prize from public.draft_prize(case when draft_row.room_id is null then 5 else 3 end, draft_row.wins);
  update career_drafts
  set status = final_status, reward_mb = prize.prize_mb, reward_pack = prize.prize_pack, finished_at = now(), updated_at = now()
  where id = draft_row.id;
  insert into career_reward_events (user_id, source_type, source_id, reward_key, manager_budget)
  values (draft_row.user_id, 'draft', draft_row.id, 'draft_prize', prize.prize_mb)
  on conflict (user_id, source_type, source_id, reward_key) do nothing;
  if found then
    update player_profiles
    set manager_budget = manager_budget + prize.prize_mb, manager_budget_earned = manager_budget_earned + prize.prize_mb, updated_at = now()
    where user_id = draft_row.user_id;
    if prize.prize_pack is not null then perform public.grant_pack(draft_row.user_id, prize.prize_pack, 1); end if;
  end if;
end;
$fn$;

-- Når begge sidene i en kamp er klare, kan den spilles. En manager står alltid hjemme mot et AI-lag,
-- og to AI-lag avgjøres med en gang.
create or replace function public.schedule_draft_fixture(target_fixture uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  fixture career_draft_fixtures%rowtype;
  home_rating integer;
  away_rating integer;
  home_goals integer;
  away_goals integer;
  home_wins boolean;
begin
  select * into fixture from career_draft_fixtures where id = target_fixture for update;
  if not found or fixture.status <> 'waiting' then return; end if;
  if (fixture.home_draft_id is null and fixture.home_ai is null) or (fixture.away_draft_id is null and fixture.away_ai is null) then return; end if;

  if fixture.home_draft_id is null and fixture.away_draft_id is not null then
    update career_draft_fixtures
    set home_draft_id = fixture.away_draft_id, home_ai = null, away_draft_id = null, away_ai = fixture.home_ai, status = 'scheduled'
    where id = fixture.id;
  elsif fixture.home_draft_id is not null then
    update career_draft_fixtures set status = 'scheduled' where id = fixture.id;
  else
    home_rating := coalesce((fixture.home_ai ->> 'rating')::integer, 75);
    away_rating := coalesce((fixture.away_ai ->> 'rating')::integer, 75);
    home_goals := public.simulate_ai_goals(home_rating, away_rating);
    away_goals := public.simulate_ai_goals(away_rating, home_rating);
    home_wins := home_goals > away_goals or (home_goals = away_goals and random() < 0.5);
    update career_draft_fixtures
    set status = 'completed', home_score = home_goals, away_score = away_goals,
      home_penalties = case when home_goals = away_goals then (case when home_wins then 5 else 4 end) end,
      away_penalties = case when home_goals = away_goals then (case when home_wins then 4 else 5 end) end,
      winner = case when home_wins then 'home' else 'away' end,
      completed_at = now()
    where id = fixture.id;
    perform public.advance_draft_fixture(fixture.id);
  end if;
end;
$fn$;

-- Etter en ferdig kamp: taperen er ute (og får premien sin), vinneren får en seier og går videre.
create or replace function public.advance_draft_fixture(target_fixture uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  fixture career_draft_fixtures%rowtype;
  winner_draft uuid;
  winner_ai jsonb;
  loser_draft uuid;
  rounds integer;
  next_fixture uuid;
begin
  select * into fixture from career_draft_fixtures where id = target_fixture;
  if not found or fixture.status <> 'completed' then return; end if;
  if fixture.winner = 'home' then
    winner_draft := fixture.home_draft_id; winner_ai := fixture.home_ai; loser_draft := fixture.away_draft_id;
  else
    winner_draft := fixture.away_draft_id; winner_ai := fixture.away_ai; loser_draft := fixture.home_draft_id;
  end if;
  rounds := case when fixture.room_id is null then 5 else 3 end;

  if loser_draft is not null then perform public.finish_draft(loser_draft, 'eliminated'); end if;
  if winner_draft is not null then
    update career_drafts set wins = wins + 1, updated_at = now() where id = winner_draft and status = 'active';
    if fixture.round >= rounds then perform public.finish_draft(winner_draft, 'champion'); end if;
  end if;

  if fixture.room_id is null then return; end if;

  -- Finalen er spilt, eller ingen managere er igjen: resten av bracketen trenger ikke spilles.
  if fixture.round >= rounds or not exists (select 1 from career_drafts where room_id = fixture.room_id and status = 'active') then
    update career_draft_rooms set status = 'completed', completed_at = now() where id = fixture.room_id and status = 'playing';
    return;
  end if;

  insert into career_draft_fixtures (room_id, round, slot) values (fixture.room_id, fixture.round + 1, fixture.slot / 2)
  on conflict (room_id, round, slot) do nothing;
  if fixture.slot % 2 = 0 then
    update career_draft_fixtures set home_draft_id = winner_draft, home_ai = winner_ai
    where room_id = fixture.room_id and round = fixture.round + 1 and slot = fixture.slot / 2
    returning id into next_fixture;
  else
    update career_draft_fixtures set away_draft_id = winner_draft, away_ai = winner_ai
    where room_id = fixture.room_id and round = fixture.round + 1 and slot = fixture.slot / 2
    returning id into next_fixture;
  end if;
  perform public.schedule_draft_fixture(next_fixture);
end;
$fn$;

-- Starter bracketen i en venneturnering. `entries` er de åtte plassene i rekkefølge:
-- { "draft_id": ... } for en manager eller { "ai": { name, rating, team } } for et AI-lag.
create or replace function public.start_draft_room(target_user uuid, target_room uuid, entries jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  room_row career_draft_rooms%rowtype;
  slot_index integer;
  first_entry jsonb;
  second_entry jsonb;
  new_fixture uuid;
  active_count integer;
begin
  select * into room_row from career_draft_rooms where id = target_room for update;
  if not found or room_row.host_id <> target_user then raise exception 'Bare den som laget draft-turneringen kan starte den'; end if;
  if room_row.status <> 'open' then raise exception 'Draft-turneringen har allerede startet'; end if;
  if exists (select 1 from career_drafts where room_id = target_room and status = 'drafting') then
    raise exception 'Alle må bli ferdige med draften først';
  end if;
  select count(*) into active_count from career_drafts where room_id = target_room and status = 'active';
  if active_count < 2 then raise exception 'Draft-turneringen trenger minst to managere'; end if;
  if jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) <> 8
    or (select count(distinct entry ->> 'draft_id') from jsonb_array_elements(entries) as entry where entry ? 'draft_id') <> active_count
    or (select count(*) from jsonb_array_elements(entries) as entry where entry ? 'draft_id') <> active_count
    or exists (
      select 1 from jsonb_array_elements(entries) as entry
      where entry ? 'draft_id' and not exists (select 1 from career_drafts where id = (entry ->> 'draft_id')::uuid and room_id = target_room and status = 'active')
    )
    or exists (select 1 from jsonb_array_elements(entries) as entry where not entry ? 'draft_id' and jsonb_typeof(entry -> 'ai') is distinct from 'object')
  then
    raise exception 'Kampoppsettet passer ikke med deltakerne';
  end if;

  delete from career_draft_room_members where room_id = target_room and status = 'invited';
  update career_draft_rooms set status = 'playing', started_at = now() where id = target_room;
  for slot_index in 0..3 loop
    first_entry := entries -> (slot_index * 2);
    second_entry := entries -> (slot_index * 2 + 1);
    insert into career_draft_fixtures (room_id, round, slot, home_draft_id, home_ai, away_draft_id, away_ai)
    values (target_room, 1, slot_index, (first_entry ->> 'draft_id')::uuid, first_entry -> 'ai', (second_entry ->> 'draft_id')::uuid, second_entry -> 'ai')
    returning id into new_fixture;
    perform public.schedule_draft_fixture(new_fixture);
  end loop;
end;
$fn$;

-- Kalles fra oppgjøret. Returnerer true hvis kampen var en draftkamp.
create or replace function public.record_draft_match_result(target_match uuid, home_goals integer, away_goals integer, home_pens integer, away_pens integer, match_result integer)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  fixture career_draft_fixtures%rowtype;
begin
  select * into fixture from career_draft_fixtures where match_id = target_match for update;
  if not found then return false; end if;
  if fixture.status = 'completed' then return true; end if;
  update career_draft_fixtures
  set status = 'completed', home_score = home_goals, away_score = away_goals, home_penalties = home_pens, away_penalties = away_pens,
    -- Draftkamper er utslagskamper og har alltid en vinner. Uavgjort kan bare skje i en ødelagt kamp, og da går hjemmelaget videre.
    winner = case when match_result >= 0 then 'home' else 'away' end,
    completed_at = now()
  where id = fixture.id;
  perform public.advance_draft_fixture(fixture.id);
  return true;
end;
$fn$;

-- Oppgjøret er likt versjonen i 0085, bortsett fra at draftkamper går til record_draft_match_result
-- i stedet for den vanlige kamppremien og sesongtabellen.
create or replace function public.settle_finished_manager_matches(target_match uuid default null)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  match_row career_matches%rowtype;
  home_goals integer;
  away_goals integer;
  shot_count integer;
  planned_seconds numeric;
  window_seconds numeric;
  match_winner uuid;
  knockout boolean;
  extra_time boolean := false;
  home_pens integer;
  away_pens integer;
  kick_count integer := 0;
  match_version integer;
  match_result integer;
  settled_count integer := 0;
begin
  for match_row in
    select *
    from career_matches
    where mode = 'manager'
      and status = 'live'
      and started_at <= now() - interval '55 seconds'
      and (target_match is null or id = target_match)
    order by started_at asc
    for update skip locked
  loop
    select count(*) into shot_count
    from jsonb_array_elements(match_row.events) as event(value)
    where event.value ->> 'type' = 'shot';

    match_version := coalesce((
      select (event.value ->> 'version')::int from jsonb_array_elements(match_row.events) as event(value)
      where event.value ->> 'type' = 'kickoff' limit 1
    ), 1);

    knockout := exists (
      select 1 from jsonb_array_elements(match_row.events) as event(value)
      where event.value ->> 'type' = 'kickoff' and coalesce((event.value ->> 'knockout')::boolean, false)
    );
    extra_time := false;
    kick_count := 0;
    home_pens := null;
    away_pens := null;

    select
      count(*) filter (where goal.event ->> 'side' = 'home'),
      count(*) filter (where goal.event ->> 'side' = 'away')
    into home_goals, away_goals
    from jsonb_array_elements(match_row.events) as goal(event)
    where goal.event ->> 'type' = 'goal' and (goal.event ->> 'minute')::int <= 90;

    home_goals := home_goals + (select count(*) from career_match_shots where match_id = match_row.id and side = 'home' and outcome = 'goal');
    away_goals := away_goals + (select count(*) from career_match_shots where match_id = match_row.id and side = 'away' and outcome = 'goal');

    if knockout and home_goals = away_goals then
      extra_time := true;
      home_goals := home_goals + (select count(*) from jsonb_array_elements(match_row.events) as goal(event)
        where goal.event ->> 'type' = 'goal' and goal.event ->> 'side' = 'home' and (goal.event ->> 'minute')::int between 91 and 120);
      away_goals := away_goals + (select count(*) from jsonb_array_elements(match_row.events) as goal(event)
        where goal.event ->> 'type' = 'goal' and goal.event ->> 'side' = 'away' and (goal.event ->> 'minute')::int between 91 and 120);

      if home_goals = away_goals then
        select
          count(*),
          count(*) filter (where kick.value ->> 'side' = 'home' and (kick.value ->> 'scored')::boolean),
          count(*) filter (where kick.value ->> 'side' = 'away' and (kick.value ->> 'scored')::boolean)
        into kick_count, home_pens, away_pens
        from jsonb_array_elements(match_row.events) as kick(value)
        where kick.value ->> 'type' = 'shootout_kick';
        if kick_count = 0 then
          home_pens := null;
          away_pens := null;
        end if;
      end if;
    end if;

    window_seconds := case
      when match_version < 5 then 10
      when match_version = 5 then 0
      else coalesce((
        select least(70, greatest(0, (event.value ->> 'ms')::numeric / 1000))
        from jsonb_array_elements(match_row.events) as event(value)
        where event.value ->> 'type' = 'sub_window_end' limit 1
      ), 70)
    end;
    planned_seconds := 55 + window_seconds + shot_count * 10
      + case when extra_time then 24 else 0 end
      + case when kick_count > 0 then 4 + kick_count * 3 else 0 end;
    if match_row.started_at > now() - make_interval(secs => planned_seconds) then
      continue;
    end if;

    match_result := case
      when home_goals > away_goals then 1
      when home_goals < away_goals then -1
      when home_pens is not null and home_pens > away_pens then 1
      when home_pens is not null and home_pens < away_pens then -1
      else 0
    end;

    match_winner := case
      when match_result = 1 then match_row.home_user_id
      when match_result = -1 then match_row.away_user_id
      else null
    end;

    update career_matches
    set
      status = 'completed',
      home_score = home_goals,
      away_score = away_goals,
      winner_id = match_winner,
      home_penalties = home_pens,
      away_penalties = away_pens,
      completed_at = now(),
      events = case
        when exists (
          select 1 from jsonb_array_elements(match_row.events) as event
          where event ->> 'type' = 'full_time'
        ) then match_row.events
        else match_row.events || jsonb_build_array(jsonb_build_object(
          'type', 'full_time',
          'minute', 90,
          'homeScore', home_goals,
          'awayScore', away_goals,
          'extraTime', extra_time,
          'homePenalties', home_pens,
          'awayPenalties', away_pens
        ))
      end
    where id = match_row.id and status = 'live';

    if not found then
      continue;
    end if;

    -- Draftkamper: premien kommer når turneringen er over, ikke per kamp.
    if public.record_draft_match_result(match_row.id, home_goals, away_goals, home_pens, away_pens, match_result) then
      settled_count := settled_count + 1;
      continue;
    end if;

    if match_row.challenge_id is not null then
      update career_challenges
      set status = 'completed'
      where id = match_row.challenge_id and status <> 'completed';
    end if;

    if match_result = 0 then
      perform award_manager_match_result(match_row.home_user_id, match_row.id, 'manager_draw', 2, 'manager_career_draws');
      if match_row.away_user_id is not null then
        perform award_manager_match_result(match_row.away_user_id, match_row.id, 'manager_draw', 2, 'manager_career_draws');
      end if;
    else
      if match_result = 1 then
        perform award_manager_match_result(match_row.home_user_id, match_row.id, 'manager_win', 5, 'manager_career_wins');
        if match_row.away_user_id is not null then
          perform award_manager_match_result(match_row.away_user_id, match_row.id, 'manager_loss', 0, 'manager_career_losses');
        end if;
      else
        perform award_manager_match_result(match_row.home_user_id, match_row.id, 'manager_loss', 0, 'manager_career_losses');
        if match_row.away_user_id is not null then
          perform award_manager_match_result(match_row.away_user_id, match_row.id, 'manager_win', 5, 'manager_career_wins');
        end if;
      end if;
    end if;

    perform public.record_season_match_result(match_row.id, home_goals, away_goals);

    settled_count := settled_count + 1;
  end loop;

  return settled_count;
end;
$$;

revoke all on function public.draft_entry_fee() from public, anon, authenticated;
revoke all on function public.start_draft(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_draft_room(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.leave_draft_room(uuid, uuid) from public, anon, authenticated;
revoke all on function public.draft_prize(integer, integer) from public, anon, authenticated;
revoke all on function public.finish_draft(uuid, text) from public, anon, authenticated;
revoke all on function public.schedule_draft_fixture(uuid) from public, anon, authenticated;
revoke all on function public.advance_draft_fixture(uuid) from public, anon, authenticated;
revoke all on function public.start_draft_room(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.record_draft_match_result(uuid, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.settle_finished_manager_matches(uuid) from public, anon, authenticated;
grant execute on function public.draft_entry_fee() to service_role;
grant execute on function public.start_draft(uuid, uuid) to service_role;
grant execute on function public.create_draft_room(uuid, uuid[]) to service_role;
grant execute on function public.leave_draft_room(uuid, uuid) to service_role;
grant execute on function public.draft_prize(integer, integer) to service_role;
grant execute on function public.finish_draft(uuid, text) to service_role;
grant execute on function public.schedule_draft_fixture(uuid) to service_role;
grant execute on function public.advance_draft_fixture(uuid) to service_role;
grant execute on function public.start_draft_room(uuid, uuid, jsonb) to service_role;
grant execute on function public.record_draft_match_result(uuid, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.settle_finished_manager_matches(uuid) to service_role;

-- Kampen og fixture-koblingen opprettes i én transaksjon. Samtidige starter gjenbruker kampen.
-- Oppdatert-tid sjekkes under radlås, så kampplanen ikke bruker et lag som er endret imens.
create or replace function public.start_draft_match(
  target_user uuid, target_fixture uuid, new_match uuid, match_events jsonb,
  expected_home_updated timestamptz, expected_away_updated timestamptz default null
)
returns uuid language plpgsql set search_path = public, pg_temp
as $fn$
declare
  fixture career_draft_fixtures%rowtype;
  home_draft career_drafts%rowtype;
  away_draft career_drafts%rowtype;
begin
  select * into fixture from career_draft_fixtures where id = target_fixture for update;
  if not found or fixture.home_draft_id is null then return null; end if;
  select * into home_draft from career_drafts where id = fixture.home_draft_id for update;
  if fixture.away_draft_id is not null then
    select * into away_draft from career_drafts where id = fixture.away_draft_id for update;
  end if;
  if target_user is distinct from home_draft.user_id and target_user is distinct from away_draft.user_id then return null; end if;
  if fixture.status = 'live' then return fixture.match_id; end if;
  if fixture.status <> 'scheduled' or home_draft.status <> 'active'
    or home_draft.updated_at is distinct from expected_home_updated
    or (fixture.away_draft_id is not null and (away_draft.status <> 'active' or away_draft.updated_at is distinct from expected_away_updated))
  then return null; end if;

  insert into career_matches (id, mode, status, started_at, events, home_user_id, away_user_id, away_ai_name)
  values (new_match, 'manager', 'live', now(), match_events, home_draft.user_id, away_draft.user_id,
    case when fixture.away_draft_id is null then coalesce(fixture.away_ai ->> 'name', 'AI') end);
  update career_draft_fixtures set status = 'live', match_id = new_match where id = fixture.id;
  update career_drafts set updated_at = clock_timestamp()
  where id in (fixture.home_draft_id, fixture.away_draft_id);
  return new_match;
end;
$fn$;
revoke all on function public.start_draft_match(uuid, uuid, uuid, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.start_draft_match(uuid, uuid, uuid, jsonb, timestamptz, timestamptz) to service_role;

-- Oppgjør også når deltakerne har forlatt kampvisningen. Bare brukerens egne drafts/rom berøres.
create or replace function public.settle_draft_matches(target_user uuid)
returns integer language plpgsql set search_path = public, pg_temp
as $fn$
declare
  match uuid;
  settled integer := 0;
begin
  for match in
    select f.match_id from career_draft_fixtures f
    where f.status = 'live' and f.match_id is not null and exists (
      select 1 from career_drafts d where d.user_id = target_user
      and (d.id = f.draft_id or d.room_id = f.room_id)
    )
  loop
    settled := settled + public.settle_finished_manager_matches(match);
  end loop;
  return settled;
end;
$fn$;
revoke all on function public.settle_draft_matches(uuid) from public, anon, authenticated;
grant execute on function public.settle_draft_matches(uuid) to service_role;
