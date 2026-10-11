-- Informs etter ekte form, som Team of the Week i FC.
-- * Inform-kortene er alltid 82–90. Kortet er vanlig-kortet (eller forrige inform) + 1–3, men løftes opp til 82
--   hvis det blir lavere. Spillere som er 90 eller mer (eller har en inform på 90) får ikke inform.
-- * Hver fredag kl. 18:00 velges 23 spillere: de som spilte best i ekte kamper siste uke, hentet fra kampdataene til
--   Fantasy (API-Football). Først en startellever (1 keeper, 4 forsvarere, 3 midtbanespillere, 3 angripere), så de
--   12 beste av resten. Boosten følger kampkarakteren: 9,0+ gir +3, 8,0+ gir +2, ellers +1.
--   Er det for få kamper med data (landslagspause, sommer), fylles resten med tilfeldige spillere som før.
-- * Jo høyere rating en inform har, jo sjeldnere er den i pakkene. Vektene per rating ligger i game_settings
--   ('inform_tiers'), og en 90 er omtrent 20 ganger sjeldnere enn en 82.
-- * Ukens runde får med en gang 20 informs, valgt for hånd etter FC 27 TOTW 2–4 (ekte form 19. sep.–5. okt. 2026).

-- 1) Innstillinger. Boosten til en inform kan nå være mer enn 3 når kortet løftes opp til 82.
insert into game_settings (key, value) values
  ('inform_round_size', '23'),
  ('inform_max_overall', '90'),
  ('inform_min_overall', '82'),
  ('inform_tiers', '[{"min":40,"max":81,"weight":30},{"min":82,"max":82,"weight":30},{"min":83,"max":83,"weight":22},{"min":84,"max":84,"weight":16},{"min":85,"max":85,"weight":11},{"min":86,"max":86,"weight":7.5},{"min":87,"max":87,"weight":5},{"min":88,"max":88,"weight":3.5},{"min":89,"max":89,"weight":2.5},{"min":90,"max":99,"weight":1.5}]')
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table special_cards drop constraint if exists special_cards_boost_check;
alter table special_cards add constraint special_cards_boost_check check (boost >= 1 or (kind = 'icon' and boost = 0));

-- 2) Lager én inform. from_overall er vanlig-kortet eller forrige inform, som kortet bygger på.
create or replace function public.insert_inform_card(target_round uuid, target_catalog uuid, from_overall integer, from_attributes jsonb, wanted_boost integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  min_overall integer := public.game_setting_int('inform_min_overall', 82);
  max_overall integer := public.game_setting_int('inform_max_overall', 90);
  new_overall integer := least(max_overall, greatest(min_overall, from_overall + wanted_boost));
  new_boost integer := new_overall - from_overall;
begin
  if new_boost < 1 then return; end if;
  insert into special_cards (round_id, kind, catalog_id, overall, boost, attributes, price)
  values (target_round, 'inform', target_catalog, new_overall, new_boost,
    coalesce((select jsonb_object_agg(attribute.key, least(99, attribute.value::integer + new_boost)) from jsonb_each_text(from_attributes) as attribute), '{}'::jsonb),
    ceil(public.card_value_for_overall(new_overall) * 1.5)::integer)
  on conflict (round_id, catalog_id) do nothing;
end;
$fn$;

revoke all on function public.insert_inform_card(uuid, uuid, integer, jsonb, integer) from public, anon, authenticated;

-- Det en spiller bygger på: siste inform (etter inform_history_from) eller vanlig-kortet.
create or replace function public.inform_base(target_catalog uuid)
returns table (from_overall integer, from_attributes jsonb)
language sql
stable
set search_path = public, pg_temp
as $fn$
  select coalesce(latest.overall, catalog.overall), coalesce(latest.attributes, catalog.attributes)
  from player_catalog catalog
  left join lateral (
    select card.overall, card.attributes from special_cards card join special_rounds round on round.id = card.round_id
    where card.kind = 'inform' and card.catalog_id = catalog.id
      and round.starts_at >= coalesce((select (value #>> '{}')::timestamptz from game_settings where key = 'inform_history_from'), '-infinity')
    order by round.starts_at desc limit 1
  ) latest on true
  where catalog.id = target_catalog;
$fn$;

revoke all on function public.inform_base(uuid) from public, anon, authenticated;

-- 3) Ukens runde: de beste fra ekte kamper, fylt opp med tilfeldige spillere hvis det mangler data.
create or replace function public.ensure_special_round()
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  bounds jsonb := public.sbc_week_bounds();
  week_start timestamptz := (bounds->>'week_start')::timestamptz;
  new_round uuid;
  round_size integer := public.game_setting_int('inform_round_size', 23);
  pool_size integer := public.game_setting_int('inform_pool_size', 400);
  cooldown integer := public.game_setting_int('inform_cooldown_rounds', 2);
  max_overall integer := public.game_setting_int('inform_max_overall', 90);
  pick record;
  missing integer;
begin
  select id into new_round from special_rounds where kind = 'inform' and starts_at = week_start;
  if new_round is not null then return new_round; end if;
  -- To samtidige forespørsler skal ikke lage to runder.
  perform pg_advisory_xact_lock(hashtext('special_rounds:inform'));
  select id into new_round from special_rounds where kind = 'inform' and starts_at = week_start;
  if new_round is not null then return new_round; end if;

  insert into special_rounds (kind, starts_at, ends_at) values ('inform', week_start, (bounds->>'next_reset')::timestamptz)
  returning id into new_round;

  -- Ekte form: beste kampkarakter siste uke (minst 45 minutter), litt ekstra for mål og målgivende.
  for pick in
    with form as (
      select player.catalog_id,
        max(stats.rating) + 0.3 * sum(stats.goals) + 0.2 * sum(stats.assists) as score
      from football_fixture_players stats
      join football_fixtures fixture on fixture.api_fixture_id = stats.api_fixture_id
      join football_players player on player.api_player_id = stats.api_player_id
      where fixture.kickoff_at >= week_start - interval '7 days' and fixture.kickoff_at < week_start
        and fixture.status in ('FT', 'AET', 'PEN')
        and stats.minutes >= 45 and stats.rating is not null and player.catalog_id is not null
      group by player.catalog_id
    ),
    candidates as (
      select form.catalog_id, form.score, base.from_overall, base.from_attributes,
        case when catalog.position = 'GK' then 'GK'
          when catalog.position in ('RB', 'CB', 'LB') then 'DEF'
          when catalog.position in ('CDM', 'CM', 'CAM') then 'MID'
          else 'FWD' end as line
      from form
      join player_catalog catalog on catalog.id = form.catalog_id and catalog.active
      cross join lateral public.inform_base(catalog.id) base
      where base.from_overall < max_overall
    ),
    ranked as (
      select candidates.*, row_number() over (partition by line order by score desc, catalog_id) as line_rank from candidates
    )
    select ranked.* from ranked
    order by (line = 'GK' and line_rank <= 1) or (line = 'DEF' and line_rank <= 4) or (line = 'MID' and line_rank <= 3) or (line = 'FWD' and line_rank <= 3) desc,
      score desc, catalog_id
    limit round_size
  loop
    perform public.insert_inform_card(new_round, pick.catalog_id, pick.from_overall, pick.from_attributes,
      case when pick.score >= 9 then 3 when pick.score >= 8 then 2 else 1 end);
  end loop;

  -- Mangler det kort, trekkes resten tilfeldig blant topp 400 som før (ikke spillere fra de siste rundene).
  missing := round_size - (select count(*) from special_cards where special_cards.round_id = new_round);
  if missing > 0 then
    for pick in
      with ranked as (
        select catalog.id, row_number() over (order by catalog.overall desc, catalog.price desc, catalog.id) as rank
        from player_catalog catalog where catalog.active
      )
      select ranked.id, base.from_overall, base.from_attributes, random() as roll
      from ranked cross join lateral public.inform_base(ranked.id) base
      where ranked.rank <= pool_size and base.from_overall < max_overall
        and ranked.id not in (select card.catalog_id from special_cards card where card.round_id = new_round)
        and ranked.id not in (
          select card.catalog_id from special_cards card
          where card.round_id in (select id from special_rounds where kind = 'inform' and starts_at < week_start order by starts_at desc limit cooldown)
        )
      order by random()
      limit missing
    loop
      perform public.insert_inform_card(new_round, pick.id, pick.from_overall, pick.from_attributes,
        case when pick.roll < 0.6 then 1 when pick.roll < 0.9 then 2 else 3 end);
    end loop;
  end if;

  return new_round;
end;
$fn$;

-- 4) Hvilken inform man får: vektet per rating fra 'inform_tiers', så høyere rating er sjeldnere.
--    TOTS bruker de gamle lagene. Resten er lik versjonen i 0074.
create or replace function public.draw_special_card(scope text, excluded uuid[])
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  current_round uuid;
  tiers jsonb := case when scope in ('current', 'informs')
    then coalesce((select value from game_settings where key = 'inform_tiers'), '[{"min":40,"max":99,"weight":1}]')
    else '[{"min":40,"max":82,"weight":50},{"min":83,"max":85,"weight":30},{"min":86,"max":87,"weight":12},{"min":88,"max":89,"weight":6},{"min":90,"max":99,"weight":2}]' end;
  candidates uuid[];
  tier jsonb;
  total_weight numeric := 0;
  roll numeric;
  running numeric := 0;
  picked uuid;
  tots_chance numeric;
  icon_chance numeric;
begin
  if scope = 'all' then
    icon_chance := coalesce((select (value #>> '{}')::numeric from game_settings where key = 'special_pack_icon_chance'), 0.05);
    tots_chance := coalesce((select (value #>> '{}')::numeric from game_settings where key = 'special_pack_tots_chance'), 0.25);
    roll := random();
    picked := public.draw_special_card(case when roll < icon_chance then 'icons' when roll < icon_chance + tots_chance then 'tots' else 'informs' end, excluded);
    -- Er typen tom, faller den tilbake på de vanligere typene.
    if picked is null then picked := public.draw_special_card('tots', excluded); end if;
    if picked is null then picked := public.draw_special_card('informs', excluded); end if;
    return picked;
  end if;

  -- Icons trekkes jevnt: de er alle 90+, så ratinglagene under ville ikke gjort noen forskjell.
  if scope = 'icons' then
    select id into picked from special_cards where kind = 'icon' and id <> all(coalesce(excluded, '{}')) order by random() limit 1;
    return picked;
  end if;

  if scope = 'current' then current_round := public.ensure_special_round(); end if;
  candidates := array(
    select id from special_cards
    where ((scope = 'current' and round_id = current_round) or (scope = 'tots' and kind = 'tots') or (scope = 'informs' and kind = 'inform'))
      and id <> all(coalesce(excluded, '{}'))
  );
  if cardinality(candidates) = 0 then return null; end if;

  for tier in select value from jsonb_array_elements(tiers) loop
    if exists (select 1 from special_cards where id = any(candidates) and overall between (tier->>'min')::integer and (tier->>'max')::integer) then
      total_weight := total_weight + (tier->>'weight')::numeric;
    end if;
  end loop;
  roll := random() * total_weight;
  for tier in select value from jsonb_array_elements(tiers) loop
    continue when not exists (select 1 from special_cards where id = any(candidates) and overall between (tier->>'min')::integer and (tier->>'max')::integer);
    running := running + (tier->>'weight')::numeric;
    if roll <= running then
      select id into picked from special_cards
      where id = any(candidates) and overall between (tier->>'min')::integer and (tier->>'max')::integer
      order by random() limit 1;
      return picked;
    end if;
  end loop;
  select id into picked from special_cards where id = any(candidates) order by random() limit 1;
  return picked;
end;
$fn$;

-- 5) Ukens runde (fra fredag 9. oktober) får 20 informs med en gang, valgt etter ekte form i FC 27 TOTW 2–4.
--    Kort fra runden som ingen eier, fjernes først. Boosten er den samme som i FC der det passer.
insert into special_rounds (kind, starts_at, ends_at)
values ('inform', (public.sbc_week_bounds()->>'week_start')::timestamptz, (public.sbc_week_bounds()->>'next_reset')::timestamptz)
on conflict (kind, starts_at) do nothing;

delete from special_cards special
using special_rounds round
where round.id = special.round_id and round.kind = 'inform' and round.starts_at = (public.sbc_week_bounds()->>'week_start')::timestamptz
  and not exists (select 1 from manager_cards card where card.special_card_id = special.id);

with picks (slug, boost) as (values
  ('bellingham', 2),                -- Jude Bellingham, Real Madrid (TOTW 4)
  ('donnarumma', 1),                -- Gianluigi Donnarumma, Manchester City (TOTW 4)
  ('de-bruyne', 1),                 -- Kevin De Bruyne, Napoli (TOTW 4)
  ('lewandowski', 1),               -- Robert Lewandowski, Barcelona (TOTW 4)
  ('marquinhos', 1),                -- Marquinhos, PSG (TOTW 2)
  ('kobel', 2),                     -- Gregor Kobel, Dortmund (TOTW 3)
  ('gyokeres', 1),                  -- Viktor Gyökeres, Arsenal (TOTW 3)
  ('bremer', 1),                    -- Bremer, Juventus (TOTW 3)
  ('luka-modric', 2),               -- Luka Modrić, AC Milan (TOTW 3)
  ('marmoush', 1),                  -- Omar Marmoush (TOTW 4)
  ('antoine-semenyo', 3),           -- Antoine Semenyo (TOTW 2)
  ('alex-baena', 1),                -- Álex Baena, Atlético Madrid (TOTW 3)
  ('joao-cancelo', 2),              -- João Cancelo, Barcelona (TOTW 4)
  ('milos-kerkez', 2),              -- Milos Kerkez, Liverpool (TOTW 4)
  ('jonathan-david', 1),            -- Jonathan David (TOTW 2)
  ('joao-felix', 3),                -- João Félix, Al-Nassr (TOTW 3)
  ('nico-elvedi', 3),               -- Nico Elvedi (TOTW 4), løftes til 82
  ('konstantinos-mavropanos', 3),   -- Konstantinos Mavropanos, West Ham (TOTW 4), løftes til 82
  ('salem-al-dawsari', 3),          -- Salem Al-Dawsari, Al-Hilal (TOTW 4), løftes til 82
  ('orri-oskarsson', 3)             -- Orri Óskarsson, Real Sociedad (TOTW 4), løftes til 82
)
select public.insert_inform_card(round.id, catalog.id, base.from_overall, base.from_attributes, picks.boost)
from picks
join player_catalog catalog on catalog.slug = picks.slug and catalog.active
cross join lateral public.inform_base(catalog.id) base
cross join (select id from special_rounds where kind = 'inform' and starts_at = (public.sbc_week_bounds()->>'week_start')::timestamptz) round
where base.from_overall < public.game_setting_int('inform_max_overall', 90);
