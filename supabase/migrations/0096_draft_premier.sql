-- Tilfeldige draftpremier: pakker i sentrum, tokeninngang og samme toppremier i begge moduser.
-- Eksisterende utbetalte drafts beholdes. Nye utbetalinger lagrer hele kombinasjonen én gang.
alter table player_profiles add column draft_tokens integer not null default 0 check (draft_tokens >= 0);
alter table career_drafts add column entry_token boolean not null default false;
alter table career_drafts add column reward_packs jsonb;
alter table career_drafts add column reward_tokens integer not null default 0 check (reward_tokens >= 0);
alter table career_drafts add column reward_option_id text;

create table career_draft_reward_options (
  id text primary key,
  mode text not null check (mode in ('solo', 'room')),
  wins integer not null check (wins between 0 and 5),
  weight integer not null check (weight > 0),
  mb integer not null check (mb >= 0),
  packs jsonb not null check (jsonb_typeof(packs) = 'array'),
  tokens integer not null default 0 check (tokens >= 0)
);
create index career_draft_reward_options_tier_idx on career_draft_reward_options(mode, wins);
alter table career_draft_reward_options enable row level security;
grant all on career_draft_reward_options to service_role;
alter table career_drafts add constraint career_drafts_reward_option_fk foreign key(reward_option_id) references career_draft_reward_options(id);

-- price er sammenligningsverdien, ikke en kjøpspris: disse pakkene kan bare vinnes.
insert into manager_packs (key,name,description,price,card_count,guarantee_min,guarantee_count,guarantees,odds,accent,sort_order,inform_chance,tots_chance,icon_chance,honorable_chance,special_guarantee,special_scope,purchasable,active) values
('draft_bronze','Draft bronsepakke','To vanlige kort på 40–74. Kun draftpremie.',10,2,40,0,'[]','[{"min": 40, "max": 59, "weight": 35}, {"min": 60, "max": 69, "weight": 50}, {"min": 70, "max": 74, "weight": 15}]','#b87333',20,0,0,0,0,0,'current',false,true),
('draft_silver','Draft sølvpakke','Tre kort på 50–79, garantert ett på 70+. Kun draftpremie.',20,3,70,1,'[{"min": 70, "count": 1}]','[{"min": 50, "max": 64, "weight": 35}, {"min": 65, "max": 69, "weight": 35}, {"min": 70, "max": 74, "weight": 25}, {"min": 75, "max": 79, "weight": 5}]','#bfc7d5',21,0,0,0,0,0,'current',false,true),
('draft_elite','Draft elitepakke','Seks kort på 80+, garantert to på 84+. Kun draftpremie.',250,6,84,2,'[{"min": 84, "count": 2}]','[{"min": 80, "max": 82, "weight": 70}, {"min": 83, "max": 83, "weight": 15}, {"min": 84, "max": 85, "weight": 11}, {"min": 86, "max": 87, "weight": 3}, {"min": 88, "max": 89, "weight": 0.8}, {"min": 90, "max": 99, "weight": 0.2}]','#a78bfa',22,0.015,0,0,0,0,'current',false,true),
('draft_champion','Draft mesterpakke','Ti kort på 80+, garantert ett på 86+ og to på 84+. Kun draftpremie.',450,10,84,3,'[{"min": 86, "count": 1}, {"min": 84, "count": 2}]','[{"min": 80, "max": 82, "weight": 70}, {"min": 83, "max": 83, "weight": 15}, {"min": 84, "max": 85, "weight": 11}, {"min": 86, "max": 87, "weight": 3}, {"min": 88, "max": 89, "weight": 0.8}, {"min": 90, "max": 99, "weight": 0.2}]','#22d3ee',23,0.025,0,0,0,0,'current',false,true);

insert into career_draft_reward_options(id,mode,wins,weight,mb,packs,tokens) values
('solo-0-0','solo',0,35,15,'[]',0),
('solo-0-1','solo',0,40,0,'[{"key": "draft_bronze", "quantity": 1}]',0),
('solo-0-2','solo',0,20,0,'[{"key": "draft_silver", "quantity": 1}]',0),
('solo-0-3','solo',0,5,5,'[]',1),
('solo-1-0','solo',1,55,5,'[{"key": "gullpakke", "quantity": 1}]',0),
('solo-1-1','solo',1,30,0,'[{"key": "gull_spillere", "quantity": 1}]',0),
('solo-1-2','solo',1,15,15,'[{"key": "draft_silver", "quantity": 2}]',0),
('solo-2-0','solo',2,45,10,'[{"key": "premium_gull", "quantity": 1}]',0),
('solo-2-1','solo',2,35,0,'[{"key": "gull_spillere", "quantity": 2}]',0),
('solo-2-2','solo',2,20,0,'[{"key": "premium_gull", "quantity": 1}, {"key": "gullpakke", "quantity": 1}]',0),
('solo-3-0','solo',3,45,10,'[{"key": "sjeldne_spillere", "quantity": 1}]',0),
('solo-3-1','solo',3,35,0,'[{"key": "premium_gull", "quantity": 2}, {"key": "gullpakke", "quantity": 1}]',0),
('solo-3-2','solo',3,20,0,'[{"key": "draft_elite", "quantity": 1}]',0),
('solo-4-0','solo',4,35,0,'[{"key": "jumbo_premium_gull", "quantity": 1}, {"key": "gullpakke", "quantity": 1}]',0),
('solo-4-1','solo',4,35,25,'[{"key": "sjeldne_spillere", "quantity": 1}, {"key": "premium_gull", "quantity": 1}]',0),
('solo-4-2','solo',4,25,0,'[{"key": "draft_elite", "quantity": 1}, {"key": "premium_gull", "quantity": 1}]',0),
('solo-4-3','solo',4,5,0,'[{"key": "draft_elite", "quantity": 1}]',1),
('solo-5-0','solo',5,45,10,'[{"key": "sjeldne_spillere", "quantity": 1}, {"key": "premium_gull", "quantity": 1}, {"key": "gullpakke", "quantity": 1}]',0),
('solo-5-1','solo',5,30,25,'[{"key": "jumbo_premium_gull", "quantity": 1}, {"key": "premium_gull", "quantity": 1}]',0),
('solo-5-2','solo',5,20,25,'[{"key": "draft_elite", "quantity": 1}, {"key": "sjeldne_spillere", "quantity": 1}]',0),
('solo-5-3','solo',5,5,0,'[{"key": "draft_champion", "quantity": 1}, {"key": "jumbo_premium_gull", "quantity": 1}]',1),
('room-0-0','room',0,35,15,'[]',0),
('room-0-1','room',0,40,0,'[{"key": "draft_bronze", "quantity": 1}]',0),
('room-0-2','room',0,20,0,'[{"key": "draft_silver", "quantity": 1}]',0),
('room-0-3','room',0,5,5,'[]',1),
('room-1-0','room',1,45,10,'[{"key": "premium_gull", "quantity": 1}]',0),
('room-1-1','room',1,35,0,'[{"key": "gull_spillere", "quantity": 2}]',0),
('room-1-2','room',1,20,0,'[{"key": "premium_gull", "quantity": 1}, {"key": "gullpakke", "quantity": 1}]',0),
('room-2-0','room',2,35,0,'[{"key": "jumbo_premium_gull", "quantity": 1}, {"key": "gullpakke", "quantity": 1}]',0),
('room-2-1','room',2,35,25,'[{"key": "sjeldne_spillere", "quantity": 1}, {"key": "premium_gull", "quantity": 1}]',0),
('room-2-2','room',2,25,0,'[{"key": "draft_elite", "quantity": 1}, {"key": "premium_gull", "quantity": 1}]',0),
('room-2-3','room',2,5,0,'[{"key": "draft_elite", "quantity": 1}]',1),
('room-3-0','room',3,45,10,'[{"key": "sjeldne_spillere", "quantity": 1}, {"key": "premium_gull", "quantity": 1}, {"key": "gullpakke", "quantity": 1}]',0),
('room-3-1','room',3,30,25,'[{"key": "jumbo_premium_gull", "quantity": 1}, {"key": "premium_gull", "quantity": 1}]',0),
('room-3-2','room',3,20,25,'[{"key": "draft_elite", "quantity": 1}, {"key": "sjeldne_spillere", "quantity": 1}]',0),
('room-3-3','room',3,5,0,'[{"key": "draft_champion", "quantity": 1}, {"key": "jumbo_premium_gull", "quantity": 1}]',1);

create or replace function public.start_draft_with_payment(target_user uuid, target_room uuid, use_token boolean)
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

  if use_token then
    update player_profiles set draft_tokens = draft_tokens - 1, updated_at = now()
    where user_id = target_user and draft_tokens > 0;
    if not found then raise exception 'Du har ingen draft tokens'; end if;
  else
    update player_profiles set manager_budget = manager_budget - fee, updated_at = now()
    where user_id = target_user and manager_budget >= fee;
    if not found then raise exception 'Ikke nok managerbudsjett'; end if;
  end if;

  insert into career_drafts (user_id, room_id, entry_fee, entry_token) values (target_user, target_room, fee, coalesce(use_token,false)) returning id into new_id;
  if target_room is not null then
    update career_draft_room_members set status = 'joined', joined_at = now(), draft_id = new_id
    where room_id = target_room and user_id = target_user;
  end if;
  return new_id;
end;
$fn$;

create or replace function public.start_draft(target_user uuid, target_room uuid default null)
returns uuid language sql set search_path = public, pg_temp
as $fn$ select public.start_draft_with_payment(target_user,target_room,false) $fn$;

create or replace function public.create_draft_room_with_payment(target_user uuid, invited uuid[], use_token boolean)
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
  perform public.start_draft_with_payment(target_user, new_room, use_token);
  return new_room;
end;
$fn$;

create or replace function public.create_draft_room(target_user uuid, invited uuid[])
returns uuid language sql set search_path = public, pg_temp
as $fn$ select public.create_draft_room_with_payment(target_user,invited,false) $fn$;

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
    if draft_row.entry_token then
      update player_profiles set draft_tokens = draft_tokens + 1, updated_at = now() where user_id = draft_row.user_id;
    else
      update player_profiles set manager_budget = manager_budget + draft_row.entry_fee, updated_at = now() where user_id = draft_row.user_id;
    end if;
  end loop;
  if room_row.host_id = target_user then
    update career_draft_rooms set status = 'cancelled', completed_at = now() where id = target_room;
  else
    delete from career_draft_room_members where room_id = target_room and user_id = target_user;
  end if;
end;
$fn$;

-- Radlåsen og ledgeren beskytter både trekningen og hele utbetalingen mot gjentakelser.
create or replace function public.finish_draft(target_draft uuid, final_status text)
returns void language plpgsql set search_path = public, pg_temp
as $fn$
declare
  draft_row career_drafts%rowtype;
  prize career_draft_reward_options%rowtype;
  roll numeric;
  rounds integer;
  pack jsonb;
begin
  select * into draft_row from career_drafts where id=target_draft for update;
  if not found or draft_row.status not in ('drafting','active') then return; end if;
  if final_status not in ('eliminated','champion') then raise exception 'Ugyldig draftresultat'; end if;
  if exists(select 1 from career_draft_fixtures where status='live' and (home_draft_id=draft_row.id or away_draft_id=draft_row.id)) then
    raise exception 'Vent til draftkampen er ferdig';
  end if;
  rounds := case when draft_row.room_id is null then 5 else 3 end;
  select random()*sum(weight) into roll from career_draft_reward_options
  where mode=case when rounds=5 then 'solo' else 'room' end and wins=least(greatest(draft_row.wins,0),rounds);
  if roll is null then raise exception 'Fant ingen draftpremier'; end if;
  for prize in select * from career_draft_reward_options
    where mode=case when rounds=5 then 'solo' else 'room' end and wins=least(greatest(draft_row.wins,0),rounds)
    order by id
  loop
    roll := roll-prize.weight;
    exit when roll < 0;
  end loop;
  update career_drafts set status=final_status, reward_mb=prize.mb, reward_pack=null,
    reward_packs=prize.packs,reward_tokens=prize.tokens,reward_option_id=prize.id,finished_at=now()
  where id=draft_row.id;
  insert into career_reward_events(user_id,source_type,source_id,reward_key,manager_budget)
  values(draft_row.user_id,'draft',draft_row.id,'draft_prize',prize.mb)
  on conflict(user_id,source_type,source_id,reward_key) do nothing;
  if found then
    update player_profiles set manager_budget=manager_budget+prize.mb,
      manager_budget_earned=manager_budget_earned+prize.mb,draft_tokens=draft_tokens+prize.tokens,updated_at=now()
    where user_id=draft_row.user_id;
    for pack in select value from jsonb_array_elements(prize.packs) loop
      perform public.grant_pack(draft_row.user_id,pack->>'key',(pack->>'quantity')::integer);
    end loop;
  end if;
end;
$fn$;
revoke all on function public.start_draft_with_payment(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.create_draft_room_with_payment(uuid,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.start_draft_with_payment(uuid,uuid,boolean) to service_role;
grant execute on function public.create_draft_room_with_payment(uuid,uuid[],boolean) to service_role;
-- Rettigheter til de eksisterende wrapperne/finish/leave er beholdt ved CREATE OR REPLACE.
