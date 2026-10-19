-- Inner Peace i alle pakkene, Icons i Stjerneutvalg og Formpakka, og nytt spesialkort i Kachow pal.
-- Hittil kom Inner Peace bare fra Kachow pal (3500 MB), og Stjerneutvalg og Formpakka kunne ikke gi Icons. Nå kan alle pakkene
-- gi Inner Peace, og sjansen vokser med prisen. Kachow pal har høyest sjanse.
-- * Ny kolonne inner_peace_chance: sjansen per kort som ikke er garantert, med samme mekanikk som inform, honorable og Icon
--   (se 0088), så pakkene får i snitt inner_peace_chance × antall kort Inner Peace-kort. Arenaen løfter den litt, som for de andre.
--   Inner Peace er sjeldnere enn honorable mention og vanligere enn Icons, siden kortene er 88–95:
--                        pris   kort   per kort   minst ett per pakke
--   Gullpakke              40      3    0,03 %    0,09 %
--   Gull spillerpakke      75      5    0,05 %    0,25 %
--   Premium gull          100      6    0,08 %    0,5 %
--   Sjeldne spillere      200      5    0,2 %     1,0 %
--   Jumbo premium gull    300      8    0,3 %     2,4 %
--   Stjerneutvalg         500      8    0,5 %     3,9 %
--   Formpakka             750      5    0,8 %     3,9 %   (pluss ett garantert spesialkort)
--   Skadoosh dude        1500     15    0,6 %     8,6 %
--   Kachow pal           3500      8    1,5 %     11 %    (pluss ett garantert spesialkort på 88+, se under)
-- * Kachow pal garanterer ikke lenger et Inner Peace-kort, men ett spesialkort på 88+ (special_scope 'elite'). Det er et
--   Inner Peace-kort (35 %), en honorable mention (35 %) eller en inform (30 %), alltid med rating 88+, og de vanlige
--   ratingvektene innen hver type. Er den trukne typen tom på 88+, prøves de andre. Icons har sin egen sjanse i pakka (ca. 9 %)
--   og er ikke med i det garanterte kortet. Samlet sjanse for minst ett Inner Peace-kort i Kachow pal er ca. 42 %
--   (35 % fra det garanterte kortet og 11 % fra de åtte andre), klart høyest av alle pakkene, og sjansen per kort er også høyest.
-- * Icons i Stjerneutvalg og Formpakka, mellom Jumbo (0,07 % per kort) og Skadoosh dude (0,23 %):
--   Stjerneutvalg 0,12 % per kort (8 kort, ca. 0,96 % per pakke) og Formpakka 0,2 % per kort (5 kort, ca. 1,0 % per pakke).

-- 1) Kolonnen og det nye scopet 'elite'.
alter table manager_packs add column if not exists inner_peace_chance numeric not null default 0 check (inner_peace_chance between 0 and 1);
alter table manager_packs drop constraint if exists manager_packs_special_scope_check;
alter table manager_packs add constraint manager_packs_special_scope_check check (special_scope in ('current', 'all', 'tots', 'mix', 'inner_peace', 'elite'));

-- 2) Scope 'elite' trekker et spesialkort på 88+ (se over). Resten er lik versjonen i 0116, så 'inner_peace', 'mix' og alle de
-- andre scopene virker som før. Skal funksjonen skrives om senere, må 'elite' tas med.
create or replace function public.draw_special_card(scope text, excluded uuid[])
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  first_scope text := case when random() < 0.5 then 'honorable' else 'informs' end;
  roll numeric := random();
  kinds text[];
  kind_scope text;
  too_low uuid[];
  picked uuid;
begin
  if scope = 'inner_peace' then
    select id into picked from special_cards
    where kind = 'inner_peace' and id <> all(coalesce(excluded, '{}'))
    order by -ln(1 - random()) / power(0.625::float8, (overall - 88)::float8)
    limit 1;
    return picked;
  end if;
  if scope = 'elite' then
    too_low := coalesce(excluded, '{}') || array(select id from special_cards where overall < 88);
    kinds := case when roll < 0.35 then array['inner_peace', 'honorable', 'informs']
      when roll < 0.70 then array['honorable', 'inner_peace', 'informs']
      else array['informs', 'honorable', 'inner_peace'] end;
    foreach kind_scope in array kinds loop
      picked := public.draw_special_card(kind_scope, too_low);
      if picked is not null then return picked; end if;
    end loop;
    return null;
  end if;
  if scope <> 'mix' then return public.draw_special_card_base(scope, excluded); end if;
  picked := public.draw_special_card_base(first_scope, excluded);
  if picked is null then picked := public.draw_special_card_base(case when first_scope = 'honorable' then 'informs' else 'honorable' end, excluded); end if;
  return picked;
end;
$fn$;

revoke all on function public.draw_special_card(text, uuid[]) from public, anon, authenticated;
grant execute on function public.draw_special_card(text, uuid[]) to service_role;

-- 3) Pakkeåpning med Inner Peace-sjanse. Ellers lik versjonen i 0088.
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

  -- Inner Peace etter Icons, før honorable mention: samme mekanikk, med inner_peace_chance per kort. Har pakka et tak
  -- for informs, gjelder taket også Inner Peace-kortene.
  chance := pack_row.inner_peace_chance * public.manager_inform_factor(target_user)
    * cardinality(drawn) / greatest(1, cardinality(drawn) - cardinality(claimed));
  if chance > 0 then
    for slot_index in 1..cardinality(drawn) loop
      continue when drawn[slot_index] = any(claimed) or slot_special[slot_index] is not null or random() >= chance;
      picked := public.draw_special_card('inner_peace', used_specials
        || case when pack_row.inform_max_overall is null then '{}'::uuid[]
          else array(select id from special_cards where kind = 'inner_peace' and overall > pack_row.inform_max_overall) end);
      exit when picked is null;
      used_specials := used_specials || picked;
      slot_special[slot_index] := picked;
      slot_catalog[slot_index] := (select catalog_id from special_cards where id = picked);
    end loop;
  end if;

  -- Honorable mention etter Inner Peace, før informs: samme mekanikk, med honorable_chance per kort. Har pakka et tak
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
    picked := public.draw_special_card(pack_row.special_scope, used_specials);
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

revoke all on function public.deliver_manager_pack(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.deliver_manager_pack(uuid, text, boolean) to service_role;

-- 4) Sjansene. Kachow pal får nytt spesialkort (scope 'elite') og ny beskrivelse.
update manager_packs set inner_peace_chance = 0.0003 where key = 'gullpakke';
update manager_packs set inner_peace_chance = 0.0005 where key = 'gull_spillere';
update manager_packs set inner_peace_chance = 0.0008 where key = 'premium_gull';
update manager_packs set inner_peace_chance = 0.002 where key = 'sjeldne_spillere';
update manager_packs set inner_peace_chance = 0.003 where key = 'jumbo_premium_gull';
update manager_packs set inner_peace_chance = 0.005, icon_chance = 0.0012 where key = 'stjerneutvalg';
update manager_packs set inner_peace_chance = 0.008, icon_chance = 0.002 where key = 'formpakka';
update manager_packs set inner_peace_chance = 0.006 where key = 'skadoosh_dude';
update manager_packs set inner_peace_chance = 0.015, special_scope = 'elite',
  description = 'Ni kort: ett spesialkort på 88+ og åtte kort på 86+, garantert ett på 90+ og to på 88+, og ca. 9 % sjanse for en Icon. Høyest sjanse for Inner Peace. Maks 1 per dag.'
where key = 'kachow_pal';
