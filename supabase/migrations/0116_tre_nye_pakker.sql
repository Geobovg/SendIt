-- Tre nye pakker i butikken, så MB har noe å brukes på mellom 500 og 3500 MB, og Skadoosh dude blir dyrere:
--   Stjerneutvalg   500 MB   8 kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.
--   Formpakka       750 MB   Ett garantert spesialkort (inform eller honorable mention) og fem kort på 83+, garantert
--                            ett på 86+ og to på 84+. Maks 3 per dag.
--   Skadoosh dude  1500 MB   Uendret, men prisen går opp fra 1000 MB. Fortsatt maks 1 per dag.
--   Kachow pal     3500 MB   Ett garantert spesialkort på 88+ (inform eller honorable mention) og åtte kort på 86+, garantert
--                            ett på 90+ og to på 88+, og ca. 9 % sjanse for en Icon. Maks 1 per dag.
-- Alle bruker mekanikkene som finnes fra før (sjikt, garantier, inform/honorable/Icon-sjanser og kjøpsgrense per dag),
-- så pakkeåpningen er bare endret ett sted: det garanterte spesialkortet kan ha en nedre ratinggrense (special_min_overall).
-- Pakkene sorteres etter pris, så Skadoosh dude får nytt sort_order.
--
-- Simulert sjanse for minst ett vanlig kort (ikke inform, honorable eller Icon) per pakke, og snittrating. Tallene
-- ved sjiktkantene (84+, 86+, 88+, 90+) avhenger ikke av hvor mange kort katalogen har per rating. Snittet gjør det,
-- så det er regnet ut med en antatt fordeling, og simulatoren traff Sjeldne spillere i 0100 (82,8 mot 82,9).
--                         snitt   84+      86+      88+      90+      Icon     inform
--   Stjerneutvalg (500)   84,3    100 %    100 %    47,3 %   6,6 %    -        21,5 %
--   Formpakka (750)       85,8    100 %    100 %    48,6 %   14,2 %   -        9,4 %   (pluss ett garantert spesialkort)
--   Skadoosh dude (1500)  85,7    100 %    100 %    100 %    44,6 %   3,0 %    67,2 %
--   Kachow pal (3500)     87,8    100 %    100 %    100 %    100 %    8,7 %    31,7 %  (pluss ett garantert spesialkort på 88+)
-- Hurtigsalg gir 25 % av kortets verdi (30 % for inform). Med den antatte fordelingen gir Stjerneutvalg og Formpakka
-- ca. 50–65 % av prisen tilbake hvis man selger alt, Skadoosh dude ca. 70 % (mot ca. 105 % ved 1000 MB, der man kunne
-- tjene på å åpne og selge) og Kachow pal ca. 36 %, med spesialkortet. Det siste er med vilje en dyr pakke for de som har mye MB.
-- Spesialkortet er verdsatt til ca. 1000 MB i simuleringen.

-- 1) Skadoosh dude koster 1500 MB, og pakkene sorteres etter pris i butikken.
update manager_packs set price = 1500, sort_order = 8 where key = 'skadoosh_dude';

-- 2) Det garanterte spesialkortet kan ha en nedre ratinggrense. Kortene under grensen holdes utenfor trekningen, på samme
-- måte som inform_max_overall (0084). Resten av deliver_manager_pack er lik versjonen i 0088.
alter table manager_packs add column if not exists special_min_overall integer check (special_min_overall is null or special_min_overall between 40 and 99);

create or replace function public.deliver_manager_pack(target_user uuid, target_pack text, paid boolean)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  profile_row player_profiles%rowtype;
  pack_row manager_packs%rowtype;
  card_row record;
  owned_before text[];
  drawn uuid[] := '{}';
  claimed uuid[] := '{}';
  slot_catalog uuid[];
  slot_special uuid[];
  used_specials uuid[] := '{}';
  normal_count integer;
  chance numeric;
  free_squad integer;
  free_storage integer;
  slot text;
  requirement jsonb;
  requirement_min integer;
  picked uuid;
  qualifying uuid;
  weakest uuid;
  replacement uuid;
  special_row special_cards%rowtype;
  pulls jsonb := '[]'::jsonb;
  new_card_id uuid;
  week_start timestamptz := (public.sbc_week_bounds()->>'week_start')::timestamptz;
begin
  select * into profile_row from player_profiles where user_id = target_user for update;
  if not found then raise exception 'Fant ikke managerprofilen'; end if;
  select * into pack_row from manager_packs where key = target_pack and active;
  if not found then raise exception 'Pakken finnes ikke'; end if;
  if paid then
    if not pack_row.purchasable then raise exception 'Denne pakken kan ikke kjøpes'; end if;
    if (pack_row.available_from is not null and now() < pack_row.available_from)
      or (pack_row.available_until is not null and now() >= pack_row.available_until) then
      raise exception 'Denne pakken er ikke tilgjengelig nå';
    end if;
    if profile_row.manager_budget < pack_row.price then raise exception 'Ikke nok managerbudsjett'; end if;
    if pack_row.weekly_limit is not null
      and (select count(*) from pack_openings where user_id = target_user and pack_key = target_pack and price > 0 and created_at >= week_start) >= pack_row.weekly_limit then
      raise exception 'Du har allerede kjøpt denne pakken denne uken';
    end if;
    if pack_row.daily_purchase_limit is not null
      and (select count(*) from pack_openings where user_id = target_user and pack_key = target_pack and price > 0 and created_at >= public.oslo_day_start()) >= pack_row.daily_purchase_limit then
      raise exception 'Du har kjøpt denne pakken % ganger i dag. Prøv igjen i morgen', pack_row.daily_purchase_limit;
    end if;
  end if;

  free_squad := public.manager_squad_capacity() - (select count(*) from manager_cards where owner_id = target_user and location = 'squad');
  free_storage := public.manager_storage_capacity() - (select count(*) from manager_cards where owner_id = target_user and location = 'storage');
  if free_squad + free_storage < pack_row.card_count then raise exception 'Du har ikke plass til % kort. Selg eller kast kort først', pack_row.card_count; end if;

  owned_before := array(select catalog_id::text || ':' || coalesce(special_card_id::text, '') from manager_cards where owner_id = target_user and catalog_id is not null);
  normal_count := greatest(0, pack_row.card_count - pack_row.special_guarantee);

  for slot_index in 1..normal_count loop
    picked := public.draw_pack_card(pack_row.odds, 0, drawn);
    if picked is null then raise exception 'Katalogen har ikke nok kort til denne pakken'; end if;
    drawn := drawn || picked;
  end loop;

  -- Garantiene sjekkes fra høyeste nivå og ned. Hvert garantert kort reserveres, så det ikke teller for flere nivåer.
  -- Mangler et kort, byttes det svakeste ureserverte kortet ut med et nytt trekk som oppfyller nivået.
  for requirement in select value from jsonb_array_elements(pack_row.guarantees) order by (value->>'min')::integer desc loop
    requirement_min := (requirement->>'min')::integer;
    for guarantee_index in 1..(requirement->>'count')::integer loop
      select id into qualifying from player_catalog
      where id = any(drawn) and id <> all(claimed) and overall >= requirement_min
      order by overall limit 1;
      if qualifying is null then
        select id into weakest from player_catalog where id = any(drawn) and id <> all(claimed) order by overall limit 1;
        exit when weakest is null;
        replacement := public.draw_pack_card(pack_row.odds, requirement_min, drawn);
        exit when replacement is null;
        drawn := array_replace(drawn, weakest, replacement);
        qualifying := replacement;
      end if;
      claimed := claimed || qualifying;
    end loop;
  end loop;

  slot_catalog := drawn;
  slot_special := array(select null::uuid from unnest(drawn));

  -- Icons først, siden de er sjeldnest: hvert kort som ikke er garantert, kan bli en Icon. Samme mekanikk som
  -- inform og TOTS under, og kort som blir Icon, kan ikke også bli inform eller TOTS.
  chance := pack_row.icon_chance * public.manager_inform_factor(target_user)
    * cardinality(drawn) / greatest(1, cardinality(drawn) - cardinality(claimed));
  if chance > 0 then
    for slot_index in 1..cardinality(drawn) loop
      continue when drawn[slot_index] = any(claimed) or random() >= chance;
      picked := public.draw_special_card('icons', used_specials);
      exit when picked is null;
      used_specials := used_specials || picked;
      slot_special[slot_index] := picked;
      slot_catalog[slot_index] := (select catalog_id from special_cards where id = picked);
    end loop;
  end if;

  -- Honorable mention etter Icons, før informs: samme mekanikk, med honorable_chance per kort. Har pakka et tak
  -- for informs, gjelder taket også HM-kortene.
  chance := pack_row.honorable_chance * public.manager_inform_factor(target_user)
    * cardinality(drawn) / greatest(1, cardinality(drawn) - cardinality(claimed));
  if chance > 0 then
    for slot_index in 1..cardinality(drawn) loop
      continue when drawn[slot_index] = any(claimed) or slot_special[slot_index] is not null or random() >= chance;
      picked := public.draw_special_card('honorable', used_specials
        || case when pack_row.inform_max_overall is null then '{}'::uuid[]
          else array(select id from special_cards where kind = 'honorable' and overall > pack_row.inform_max_overall) end);
      exit when picked is null;
      used_specials := used_specials || picked;
      slot_special[slot_index] := picked;
      slot_catalog[slot_index] := (select catalog_id from special_cards where id = picked);
    end loop;
  end if;

  -- Hvert kort som ikke er garantert, kan bli en av ukens informs. Garanterte kort holdes utenfor, så
  -- sjansen for de andre løftes tilsvarende, og snittet per kort i pakka blir inform_chance. Arenaen løfter den litt.
  -- Har pakka et tak for informs, holdes ukens informs over taket utenfor trekningen.
  if pack_row.inform_max_overall is not null then
    used_specials := used_specials || array(select id from special_cards where round_id = public.ensure_special_round() and overall > pack_row.inform_max_overall);
  end if;
  chance := pack_row.inform_chance * public.manager_inform_factor(target_user)
    * cardinality(drawn) / greatest(1, cardinality(drawn) - cardinality(claimed));
  if chance > 0 then
    for slot_index in 1..cardinality(drawn) loop
      continue when drawn[slot_index] = any(claimed) or slot_special[slot_index] is not null or random() >= chance;
      picked := public.draw_special_card('current', used_specials);
      exit when picked is null;
      used_specials := used_specials || picked;
      slot_special[slot_index] := picked;
      slot_catalog[slot_index] := (select catalog_id from special_cards where id = picked);
    end loop;
  end if;

  -- Samme mekanikk for TOTS, men bare for kort som ikke allerede ble Icon, HM eller inform.
  chance := pack_row.tots_chance * public.manager_inform_factor(target_user)
    * cardinality(drawn) / greatest(1, cardinality(drawn) - cardinality(claimed));
  if chance > 0 then
    for slot_index in 1..cardinality(drawn) loop
      continue when drawn[slot_index] = any(claimed) or slot_special[slot_index] is not null or random() >= chance;
      picked := public.draw_special_card('tots', used_specials);
      exit when picked is null;
      used_specials := used_specials || picked;
      slot_special[slot_index] := picked;
      slot_catalog[slot_index] := (select catalog_id from special_cards where id = picked);
    end loop;
  end if;

  for slot_index in 1..pack_row.special_guarantee loop
    picked := public.draw_special_card(pack_row.special_scope, used_specials
      || case when pack_row.special_min_overall is null then '{}'::uuid[]
        else array(select id from special_cards where overall < pack_row.special_min_overall) end);
    if picked is null then raise exception 'Det finnes ingen spesialkort å trekke ennå'; end if;
    used_specials := used_specials || picked;
    slot_catalog := slot_catalog || (select catalog_id from special_cards where id = picked);
    slot_special := slot_special || picked;
  end loop;

  for slot_index in 1..cardinality(slot_catalog) loop
    select * into card_row from player_catalog where id = slot_catalog[slot_index];
    special_row := null;
    if slot_special[slot_index] is not null then select * into special_row from special_cards where id = slot_special[slot_index]; end if;
    -- Triggeren sender kortet til lageret hvis spilleren allerede er i troppen, så plassen leses tilbake fra raden.
    -- Lageret kan ha så mange av samme kort man vil.
    slot := case when free_squad > 0 then 'squad' else 'storage' end;
    insert into manager_cards (owner_id, catalog_id, name, position, overall, attributes, acquired_price, location, special_card_id, tradable)
    values (target_user, card_row.id, card_row.name, card_row.position,
      coalesce(special_row.overall, card_row.overall), coalesce(special_row.attributes, card_row.attributes),
      coalesce(special_row.price, card_row.price), slot, special_row.id, not pack_row.untradable)
    returning id, location into new_card_id, slot;
    if slot = 'squad' then free_squad := free_squad - 1; else free_storage := free_storage - 1; end if;
    pulls := pulls || jsonb_build_object(
      'card_id', new_card_id, 'catalog_id', card_row.id, 'slug', card_row.slug, 'name', card_row.name,
      'position', card_row.position, 'overall', coalesce(special_row.overall, card_row.overall), 'price', coalesce(special_row.price, card_row.price),
      'accent', card_row.accent, 'club', card_row.club, 'attributes', coalesce(special_row.attributes, card_row.attributes),
      'location', slot, 'special', special_row.kind, 'tradable', not pack_row.untradable,
      'duplicate', (card_row.id::text || ':' || coalesce(special_row.id::text, '')) = any(owned_before));
  end loop;

  if paid then
    update player_profiles set manager_budget = manager_budget - pack_row.price, updated_at = now() where user_id = target_user;
  end if;
  insert into pack_openings (user_id, pack_key, price, pulls) values (target_user, pack_row.key, case when paid then pack_row.price else 0 end, pulls);
  return pulls;
end;
$fn$;

-- 3) De tre nye pakkene. Formpakka og Kachow pal har ett garantert spesialkort (special_guarantee), som kommer i tillegg
-- til de andre kortene og telles med i card_count. Begge trekker inform eller honorable mention (scope 'mix', se 0114).
-- I Kachow pal må spesialkortet være 88+ (special_min_overall).
-- Oddsen er vekter per sjikt (se 0034).
insert into manager_packs (key, name, description, price, card_count, guarantee_min, guarantee_count, guarantees, odds, accent, sort_order,
  inform_chance, tots_chance, icon_chance, honorable_chance, special_guarantee, special_scope, purchasable, weekly_limit, daily_purchase_limit, untradable, daily_limit, available_from, available_until, special_min_overall) values
  ('stjerneutvalg', 'Stjerneutvalg', 'Åtte kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.', 500, 8, 85, 3,
    '[{"min":87,"count":1},{"min":85,"count":2}]',
    '[{"min":82,"max":82,"weight":34},{"min":83,"max":83,"weight":26},{"min":84,"max":84,"weight":16},{"min":85,"max":85,"weight":12},{"min":86,"max":86,"weight":6.5},{"min":87,"max":87,"weight":3.2},{"min":88,"max":89,"weight":2},{"min":90,"max":99,"weight":0.3}]',
    '#60a5fa', 6, 0.03, 0, 0, 0.01, 0, 'current', true, null, 3, false, null, null, null, null),
  ('formpakka', 'Formpakka', 'Ett spesialkort (inform eller honorable mention) og fem kort på 83+, garantert ett på 86+ og to på 84+. Maks 3 per dag.', 750, 6, 84, 3,
    '[{"min":86,"count":1},{"min":84,"count":2}]',
    '[{"min":83,"max":83,"weight":22},{"min":84,"max":84,"weight":20},{"min":85,"max":85,"weight":18},{"min":86,"max":86,"weight":17},{"min":87,"max":87,"weight":11},{"min":88,"max":89,"weight":9},{"min":90,"max":99,"weight":3}]',
    '#34d399', 7, 0.02, 0, 0, 0.01, 1, 'mix', true, null, 3, false, null, null, null, null),
  ('kachow_pal', 'Kachow pal', 'Ni kort: ett spesialkort på 88+ (inform eller honorable mention) og åtte kort på 86+, garantert ett på 90+ og to på 88+, og ca. 9 % sjanse for en Icon. Maks 1 per dag.', 3500, 9, 88, 3,
    '[{"min":90,"count":1},{"min":88,"count":2}]',
    '[{"min":86,"max":86,"weight":34},{"min":87,"max":87,"weight":27},{"min":88,"max":88,"weight":17},{"min":89,"max":89,"weight":11},{"min":90,"max":90,"weight":6},{"min":91,"max":91,"weight":3},{"min":92,"max":99,"weight":2}]',
    '#a78bfa', 9, 0.05, 0, 0.0112, 0.04, 1, 'mix', true, null, 1, false, null, null, null, 88)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price = excluded.price, card_count = excluded.card_count,
  guarantee_min = excluded.guarantee_min, guarantee_count = excluded.guarantee_count, guarantees = excluded.guarantees, odds = excluded.odds,
  accent = excluded.accent, sort_order = excluded.sort_order, inform_chance = excluded.inform_chance, tots_chance = excluded.tots_chance,
  icon_chance = excluded.icon_chance, honorable_chance = excluded.honorable_chance, special_guarantee = excluded.special_guarantee,
  special_scope = excluded.special_scope, purchasable = excluded.purchasable, weekly_limit = excluded.weekly_limit,
  daily_purchase_limit = excluded.daily_purchase_limit, untradable = excluded.untradable, daily_limit = excluded.daily_limit,
  available_from = excluded.available_from, available_until = excluded.available_until, special_min_overall = excluded.special_min_overall, active = true;
