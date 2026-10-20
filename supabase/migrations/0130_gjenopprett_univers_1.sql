-- De som ble flyttet av 0128 mistet MB-en, stadionet og alle kort utenfor laget og benken i univers 1 (0129 bygde bare opp laget og benken,
-- med 120 MB). Her gis noe tilbake, bare i univers 1. Er univers 1 det de spiller i nå, oppdateres de levende radene.
-- Er de i et annet univers, oppdateres det lagrede universet 1 i universe_saves. Har de spilt videre i univers 1 siden 0129,
-- beholdes det som er høyest, så ingen mister noe.
-- * Bjarne: 17 000 MB og stadion for 32 810 MB (klubbhus 5, billettluke 8, kasse 8, treningsfelt 6, tribune 7, supporterfelt 5, speiderhytte 5),
--   etter det han husker, og kortene han hadde utenfor laget og benken, så langt de kan leses ut av pakkelogg (se under).
-- * f_edits, den andre som ble flyttet av 0128: 5 000 MB og stadion for 5 810 MB (klubbhus 3, billettluke 5, kasse 5, treningsfelt 4,
--   tribune 4, supporterfelt 3, speiderhytte 2).
-- Fordelingen på byggene er en gjetning. Kortene hentes fra pack_openings.pulls, som er loggen over kort fra pakker: kort trukket etter
-- nullstillingen (0128 bruker 9. oktober) og før flyttingen, som ikke allerede ligger i det gjenopprettede laget. Antallet er det arkivbildet
-- sier han hadde (card_count) minus det som finnes, og er det flere trukne kort enn plasser, tas de med høyest rating. Kort han kjøpte i
-- katalogen eller på markedet, og kort han solgte eller leverte inn, står ikke i loggen. Kortene legges i klubblageret.

create function pg_temp.patch_universe_one(target_user uuid, target_budget integer, levels jsonb, recover_cards boolean)
returns void
language plpgsql
as $fn$
declare
  current_universe integer;
  saved jsonb;
  archive record;
  recovered jsonb := '[]'::jsonb;
begin
  select universe into current_universe from public.player_profiles where user_id = target_user;
  if current_universe is null then return; end if;
  if current_universe <> 1 then
    select data into saved from public.universe_saves where user_id = target_user and universe = 1 for update;
    if not found then return; end if;
  end if;

  if recover_cards then
    select snapshot, archived_at into archive from public.universe_archives where user_id = target_user and universe = 1;
    if found then
      with existing as (
        select card.catalog_id, card.overall, special.kind as special
        from public.manager_cards card left join public.special_cards special on special.id = card.special_card_id
        where current_universe = 1 and card.owner_id = target_user
          and not exists (select 1 from public.personal_cards personal where personal.card_id = card.id)
        union all
        select (stored->>'catalog_id')::uuid, (stored->>'overall')::integer, (select kind from public.special_cards where id = (stored->>'special_card_id')::uuid)
        from jsonb_array_elements(case when current_universe = 1 then '[]'::jsonb else saved->'cards' end) as stored
      ), owned as (
        select catalog_id, overall, special, count(*) as n from existing group by catalog_id, overall, special
      ), pulled as (
        select pull, opening.created_at, (pull->>'catalog_id')::uuid as catalog_id, nullif(pull->>'special', '') as special, (pull->>'overall')::integer as overall,
          row_number() over (partition by pull->>'catalog_id', coalesce(pull->>'special', ''), pull->>'overall' order by opening.created_at, opening.id) as nth
        from public.pack_openings opening cross join lateral jsonb_array_elements(opening.pulls) as pull
        where opening.user_id = target_user and opening.created_at >= timestamptz '2026-10-09 00:00:00+00' and opening.created_at < archive.archived_at
          and pull->>'catalog_id' is not null
      )
      select coalesce(jsonb_agg(picked.card), '[]'::jsonb) into recovered from (
        select jsonb_build_object(
          'id', gen_random_uuid(), 'owner_id', target_user, 'catalog_id', pulled.catalog_id, 'name', pulled.pull->>'name',
          'position', pulled.pull->>'position', 'overall', pulled.overall, 'attributes', pulled.pull->'attributes',
          'tradable', coalesce((pulled.pull->>'tradable')::boolean, true), 'is_starter', false,
          'acquired_price', coalesce((pulled.pull->>'price')::integer, 0), 'created_at', now(), 'location', 'storage',
          'special_card_id', (select special.id from public.special_cards special where special.kind = pulled.special and special.catalog_id = pulled.catalog_id
            order by abs(special.overall - pulled.overall) limit 1),
          'alt_positions', to_jsonb(coalesce(cat.alt_positions, '{}'::text[]))) as card
        from pulled
        join public.player_catalog cat on cat.id = pulled.catalog_id
        left join owned on owned.catalog_id = pulled.catalog_id and owned.overall = pulled.overall and owned.special is not distinct from pulled.special
        where pulled.nth > coalesce(owned.n, 0)
        order by pulled.overall desc, pulled.created_at desc
        limit greatest(0, (archive.snapshot->>'card_count')::integer - ((select count(*) from existing) + 1))
      ) as picked;
    end if;
  end if;

  if current_universe = 1 then
    update public.player_profiles set manager_budget = greatest(manager_budget, target_budget), updated_at = now() where user_id = target_user;
    insert into public.stadium_buildings (user_id, building, level)
    select target_user, entry.key, entry.value::integer from jsonb_each_text(levels) as entry
    on conflict (user_id, building) do update set level = excluded.level where stadium_buildings.level < excluded.level;
    insert into public.manager_cards select * from jsonb_populate_recordset(null::public.manager_cards, recovered);
    return;
  end if;

  update public.universe_saves
  set data = jsonb_set(jsonb_set(jsonb_set(saved,
    '{profile,manager_budget}', to_jsonb(greatest((saved->'profile'->>'manager_budget')::integer, target_budget))),
    '{cards}', (saved->'cards') || recovered),
    '{buildings}',
    (select coalesce(jsonb_agg(
      case when existing.item is not null and (existing.item->>'level')::integer >= entry.value::integer then existing.item
      else jsonb_build_object('user_id', target_user, 'building', entry.key, 'level', entry.value::integer,
        'upgrade_to', null, 'upgrade_started_at', null, 'upgrade_ends_at', null) end), '[]'::jsonb)
    from jsonb_each_text(levels) as entry
    left join lateral (select item from jsonb_array_elements(saved->'buildings') as item where item->>'building' = entry.key) as existing on true)),
    saved_at = now()
  where user_id = target_user and universe = 1;
end;
$fn$;

do $$
declare
  bjarne uuid;
  f_edits uuid;
begin
  select id into bjarne from public.profiles where username = 'Bjarne';
  if bjarne is not null then
    perform pg_temp.patch_universe_one(bjarne, 17000,
      '{"klubbhus": 5, "billettluke": 8, "kasse": 8, "treningsfelt": 6, "tribune": 7, "supporterfelt": 5, "speiderhytte": 5}', true);
  end if;
  select id into f_edits from public.profiles where username = 'f_edits';
  if f_edits is not null then
    perform pg_temp.patch_universe_one(f_edits, 5000,
      '{"klubbhus": 3, "billettluke": 5, "kasse": 5, "treningsfelt": 4, "tribune": 4, "supporterfelt": 3, "speiderhytte": 2}', false);
  end if;
end $$;
