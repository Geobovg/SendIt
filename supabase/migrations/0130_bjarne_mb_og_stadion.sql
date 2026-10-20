-- Bjarne mistet MB-en og stadionet i univers 1 da han ble flyttet av 0128 (0129 bygde bare opp laget og benken, med 120 MB).
-- Han husker ca. 17 000 MB og 30-40 000 brukt på stadion. Her settes 17 000 MB og et stadion som koster 32 810 MB: klubbhus 5,
-- billettluke 8, kasse 8, treningsfelt 6, tribune 7, supporterfelt 5 og speiderhytte 5. Fordelingen på byggene er en gjetning.
-- Har han spilt videre i univers 1 siden 0129, beholdes det som er høyest, så han aldri mister noe:
-- * Er univers 1 det han spiller i nå, oppdateres de levende radene.
-- * Er han i et annet univers, oppdateres det lagrede universet 1 i universe_saves.

do $$
declare
  bjarne uuid;
  target_budget constant integer := 17000;
  levels constant jsonb := '{"klubbhus": 5, "billettluke": 8, "kasse": 8, "treningsfelt": 6, "tribune": 7, "supporterfelt": 5, "speiderhytte": 5}';
  current_universe integer;
  saved jsonb;
begin
  select id into bjarne from profiles where username = 'Bjarne';
  if bjarne is null then return; end if;
  select universe into current_universe from player_profiles where user_id = bjarne;
  if current_universe is null then return; end if;

  if current_universe = 1 then
    update player_profiles set manager_budget = greatest(manager_budget, target_budget), updated_at = now() where user_id = bjarne;
    insert into stadium_buildings (user_id, building, level)
    select bjarne, entry.key, entry.value::integer from jsonb_each_text(levels) as entry
    on conflict (user_id, building) do update set level = excluded.level where stadium_buildings.level < excluded.level;
    return;
  end if;

  select data into saved from universe_saves where user_id = bjarne and universe = 1 for update;
  if not found then return; end if;
  update universe_saves
  set data = jsonb_set(
    jsonb_set(saved, '{profile,manager_budget}', to_jsonb(greatest((saved->'profile'->>'manager_budget')::integer, target_budget))),
    '{buildings}',
    (select coalesce(jsonb_agg(
      case when existing.item is not null and (existing.item->>'level')::integer >= entry.value::integer then existing.item
      else jsonb_build_object('user_id', bjarne, 'building', entry.key, 'level', entry.value::integer,
        'upgrade_to', null, 'upgrade_started_at', null, 'upgrade_ends_at', null) end), '[]'::jsonb)
    from jsonb_each_text(levels) as entry
    left join lateral (select item from jsonb_array_elements(saved->'buildings') as item where item->>'building' = entry.key) as existing on true)),
    saved_at = now()
  where user_id = bjarne and universe = 1;
end $$;
