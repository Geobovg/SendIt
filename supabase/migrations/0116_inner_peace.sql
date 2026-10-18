-- Spesialkort, femte type: Inner Peace. 30 spillere på 88–95. Temaet er roen fra Kung Fu Panda: Oogway, mesteren som aldri
-- hastet, og Po, som finner ro og flyt når han slutter å tenke og bare spiller. Kortene går til de som er i flyt akkurat nå.
-- * Messi er beholdt på 95. Han er Oogway, mesteren. Ødegaard (93), Berg (90), Pavlović (89), Nusa (92) og Joan García (91) har fått
--   rating for hånd, og ikke ut fra rangeringen under.
-- * De 29 andre er kjente og lovende spillere fra de fem store ligaene (Premier League, LaLiga, Serie A, Bundesliga og Ligue 1),
--   pluss nordmenn, som har gjort det best i år ifølge FotMob (18.10.2026). Ratingen følger formen: FotMobs snittrating i
--   hovedserien for 2026/27, justert for spilletid ved at ratingen trekkes mot 6,9 med en vekt på 360 minutter, så en toppkamp
--   ikke slår 700 minutter jevn form. Minst 300 minutter.
-- * «Kjent» og «lovende» er vurdert ut fra FotMob: markedsverdi, alder og navn. De fleste er 25 år eller yngre med markedsverdi
--   over 20 millioner euro (Olise, Pavlović, Rogers, Cherki, Nico Paz, Nusa, Güler, Cubarsí, Mainoo og flere), pluss noen
--   kjente veteraner (Dybala og Aubameyang) og nordmennene Ødegaard, Berg, Hauge og Nusa. Ukjente spillere med lav markedsverdi
--   og spillere som bare får +1 eller +2 (Bellingham, Mbappé) er ikke med.
-- * Realistiske løft: ingen får mer enn 11 over vanlig-kortet, bortsett fra Patrick Berg (+16), som har spilt 1790 minutter i
--   Eliteserien. De fleste får 5–11, og Ødegaard +3. Ratingen følger formen, så beste form gir best rating, med unntak av de som er
--   satt for hånd. Alle stats får samme løft som ratingen (maks 99), som for honorable mention. Kortet koster 2
--   ganger verdien på ratingen.
-- * Utvalget er valgt fra alle spillertroppene i de fem ligaene og Eliteserien (112 lag), de som finnes i katalogen og har
--   FotMob-rating og spilletid. Aron Dønnum har 8,69, men bare 70 minutter, og er ikke med. De 29 spillerne fra det første
--   utkastet er ikke med igjen.
-- * Kortet trekkes bare av pakker med special_scope 'inner_peace', foreløpig Kachow pal (0117). Lavere rating er vanligere, så
--   95 er sjeldnest: hvert kort vektes med 0,625 per rating over 88, og sjansen per trekk blir ca. 44 % for 88, 35 % for 89,
--   12 % for 90, 6 % for 91, 1,9 % for 92, 0,6 % for 93, 0,4 % for 94 og 0,2 % for 95. Det gir 90+ i ca. 21 %.
-- * Hvis en av spillerne ikke finnes i katalogen i databasen, feiler migreringen i stedet for å lage færre enn 30 kort.

-- 1) Inner Peace er en ny type i rundene og kortene, og et nytt scope for spesialkort i pakker.
alter table special_rounds drop constraint if exists special_rounds_kind_check;
alter table special_rounds add constraint special_rounds_kind_check check (kind in ('inform', 'tots', 'icon', 'honorable', 'inner_peace'));
alter table special_cards drop constraint if exists special_cards_kind_check;
alter table special_cards add constraint special_cards_kind_check check (kind in ('inform', 'tots', 'icon', 'honorable', 'inner_peace'));
alter table manager_packs drop constraint if exists manager_packs_special_scope_check;
alter table manager_packs add constraint manager_packs_special_scope_check check (special_scope in ('current', 'all', 'tots', 'mix', 'inner_peace'));

-- 2) Runden og de 30 kortene. Rundens startdato betyr ingenting for Inner Peace, og runden slutter ikke å gjelde.
insert into special_rounds (kind, starts_at, ends_at) values ('inner_peace', '2026-10-18 00:00:00+02', '2100-01-01 00:00:00+00')
on conflict (kind, starts_at) do nothing;

with picks (slug, overall) as (values
  ('messi', 95),                     -- Lionel Messi, Oogway: mesteren
  ('olise', 94),                     -- Michael Olise, Bayern München, 24 år: FotMob 8,55 på 483 min, 5 mål og 2 assist (vanlig-kort 85)
  ('odegaard', 93),                  -- Martin Ødegaard, Arsenal, 27 år, nordmann: FotMob 7,55 på 471 min, 2 mål og 0 assist (vanlig-kort 90)
  ('paulo-dybala', 92),              -- Paulo Dybala, Roma, 32 år: FotMob 7,99 på 496 min, 0 mål og 4 assist (vanlig-kort 81)
  ('nusa', 92),                      -- Antonio Nusa, RB Leipzig, 21 år, nordmann: FotMob 7,79 på 466 min, 3 mål og 3 assist (vanlig-kort 83)
  ('morgan-rogers', 91),             -- Morgan Rogers, Chelsea, 24 år: FotMob 7,90 på 613 min, 4 mål og 1 assist (vanlig-kort 83)
  ('rayan-cherki', 91),              -- Rayan Cherki, Manchester City, 23 år: FotMob 8,04 på 395 min, 4 mål og 2 assist (vanlig-kort 84)
  ('nico-paz', 91),                  -- Nico Paz, Como, 22 år: FotMob 7,88 på 510 min, 1 mål og 1 assist (vanlig-kort 82)
  ('joan-garcia', 91),               -- Joan García, Barcelona, 25 år: FotMob 7,18 på 675 min, 0 mål og 0 assist (vanlig-kort 82)
  ('lamine-camara', 90),             -- Lamine Camara, Monaco, 22 år: FotMob 8,01 på 540 min, 0 mål og 1 assist (vanlig-kort 79)
  ('davies', 90),                    -- Alphonso Davies, Bayern München, 25 år: FotMob 8,02 på 362 min, 0 mål og 2 assist (vanlig-kort 84)
  ('joao-pedro', 90),                -- João Pedro, Chelsea, 25 år: FotMob 7,74 på 521 min, 5 mål og 3 assist (vanlig-kort 82)
  ('luis-diaz', 90),                 -- Luis Díaz, Bayern München, 29 år: FotMob 7,70 på 445 min, 4 mål og 1 assist (vanlig-kort 84)
  ('patrick-berg', 90),              -- Patrick Berg, Bodø/Glimt, 28 år, nordmann: FotMob 7,85 på 1790 min, 2 mål og 2 assist (vanlig-kort 74)
  ('aleksandar-pavlovic', 89),       -- Aleksandar Pavlović, Bayern München, 22 år: FotMob 8,15 på 457 min, 2 mål og 1 assist (vanlig-kort 82)
  ('jens-petter-hauge', 89),         -- Jens Petter Hauge, Bodø/Glimt, 27 år, nordmann: FotMob 7,69 på 1287 min, 5 mål og 4 assist (vanlig-kort 78)
  ('pierre-emerick-aubameyang', 89), -- Pierre-Emerick Aubameyang, Deportivo A Coruña, 37 år: FotMob 7,70 på 560 min, 5 mål og 2 assist (vanlig-kort 78)
  ('fermin-lopez', 89),              -- Fermín López, Barcelona, 23 år: FotMob 7,63 på 538 min, 4 mål og 3 assist (vanlig-kort 82)
  ('arda-guler', 89),                -- Arda Güler, Real Madrid, 21 år: FotMob 7,62 på 426 min, 1 mål og 2 assist (vanlig-kort 84)
  ('cubarsi', 89),                   -- Pau Cubarsí, Barcelona, 19 år: FotMob 7,56 på 512 min, 0 mål og 2 assist (vanlig-kort 82)
  ('elliot-anderson', 89),           -- Elliot Anderson, Manchester City, 23 år: FotMob 7,55 på 518 min, 0 mål og 1 assist (vanlig-kort 83)
  ('jobe-bellingham', 89),           -- Jobe Bellingham, Borussia Dortmund, 21 år: FotMob 7,52 på 460 min, 0 mål og 1 assist (vanlig-kort 78)
  ('lewis-hall', 89),                -- Lewis Hall, Newcastle United, 22 år: FotMob 7,42 på 629 min, 1 mål og 1 assist (vanlig-kort 79)
  ('kobbie-mainoo', 88),             -- Kobbie Mainoo, Manchester United, 21 år: FotMob 7,49 på 447 min, 0 mål og 1 assist (vanlig-kort 82)
  ('james-trafford', 88),            -- James Trafford, Leeds United, 24 år: FotMob 7,38 på 540 min, 0 mål og 0 assist (vanlig-kort 80)
  ('can-uzun', 88),                  -- Can Uzun, Eintracht Frankfurt, 20 år: FotMob 7,43 på 414 min, 2 mål og 0 assist (vanlig-kort 78)
  ('francisco-conceicao', 88),       -- Francisco Conceição, Juventus, 23 år: FotMob 7,30 på 409 min, 1 mål og 1 assist (vanlig-kort 82)
  ('franco-mastantuono', 88),        -- Franco Mastantuono, Fiorentina, 19 år: FotMob 7,22 på 467 min, 3 mål og 0 assist (vanlig-kort 78)
  ('yan-diomande', 88),              -- Yan Diomande, Real Madrid, 19 år: FotMob 7,18 på 366 min, 1 mål og 1 assist (vanlig-kort 77)
  ('dean-huijsen', 88)               -- Dean Huijsen, Real Madrid, 21 år: FotMob 7,07 på 502 min, 0 mål og 0 assist (vanlig-kort 82)
)
insert into special_cards (round_id, kind, catalog_id, overall, boost, attributes, price)
select round.id, 'inner_peace', catalog.id, rating.overall, rating.overall - catalog.overall,
  coalesce((select jsonb_object_agg(attribute.key, least(99, attribute.value::integer + rating.overall - catalog.overall)) from jsonb_each_text(catalog.attributes) as attribute), '{}'::jsonb),
  ceil(public.card_value_for_overall(rating.overall) * 2)::integer
from picks
join player_catalog catalog on catalog.slug = picks.slug
cross join lateral (select greatest(picks.overall, catalog.overall + 1) as overall) rating
cross join (select id from special_rounds where kind = 'inner_peace' and starts_at = '2026-10-18 00:00:00+02') round
on conflict (round_id, catalog_id) do nothing;

do $fn$
declare
  found_cards integer := (select count(*) from special_cards where kind = 'inner_peace');
begin
  if found_cards <> 30 then raise exception 'Forventet 30 Inner Peace-kort, men fant %. Mangler en av spillerne i katalogen?', found_cards; end if;
end;
$fn$;

-- 3) Scope 'inner_peace' trekker blant Inner Peace-kortene. Vektingen følger ratingen (se øverst). Resten er lik versjonen i
-- 0114, så 'mix' og alle de andre scopene virker som før. Skal funksjonen skrives om senere, må 'inner_peace' tas med.
create or replace function public.draw_special_card(scope text, excluded uuid[])
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  first_scope text := case when random() < 0.5 then 'honorable' else 'informs' end;
  picked uuid;
begin
  if scope = 'inner_peace' then
    select id into picked from special_cards
    where kind = 'inner_peace' and id <> all(coalesce(excluded, '{}'))
    order by -ln(1 - random()) / power(0.625::float8, (overall - 88)::float8)
    limit 1;
    return picked;
  end if;
  if scope <> 'mix' then return public.draw_special_card_base(scope, excluded); end if;
  picked := public.draw_special_card_base(first_scope, excluded);
  if picked is null then picked := public.draw_special_card_base(case when first_scope = 'honorable' then 'informs' else 'honorable' end, excluded); end if;
  return picked;
end;
$fn$;
