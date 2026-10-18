-- Spesialkort, femte type: Inner Peace. 30 spillere på 88–95. Temaet er roen fra Kung Fu Panda: Oogway, mesteren som aldri
-- hastet, og Po, som finner ro og flyt når han slutter å tenke og bare spiller. Kortene går til de som er i flyt akkurat nå.
-- * Messi er beholdt på 95. Han er Oogway, mesteren.
-- * De 29 andre er valgt etter FotMob (18.10.2026): de som har gjort det best i år, med best rating under Messi. Grunnlaget er
--   FotMobs snittrating i hovedserien for sesongen 2026/27 (profilsidene), justert for spilletid ved at ratingen trekkes mot 6,9
--   med en vekt på 360 minutter, så en toppkamp ikke slår 700 minutter jevn form. Minst 300 minutter og maks tre keepere.
--   Rekkefølgen gir ratingen: best 94, så 93 (2), 92 (3), 91 (4), 90 (5), 89 (6) og 88 (8). Messi på 95 er alene på toppen.
-- * Ratingen følger prestasjonen, ikke vanlig-kortet, så spillere med lavere vanlig-kort får store løft (opptil +18). Ratingen er
--   alltid minst ett over vanlig-kortet. Alle stats får samme løft som ratingen (maks 99), som for honorable mention.
--   Kortet koster 2 ganger verdien på ratingen.
-- * Utvalget er de som står på toppen i FotMobs ligastatistikk (topp 3 i hver av 38–43 kategorier i Premier League, LaLiga,
--   Serie A, Bundesliga, Ligue 1, Eredivisie, Liga Portugal og Champions League) og som finnes i katalogen. Spillere som ikke
--   er i noen toppliste, er ikke vurdert. Eliteserien er med via Patrick Berg, som har spilt 1790 minutter. De 29 spillerne
--   fra det første utkastet er ikke med igjen.
-- * Kortet trekkes bare av pakker med special_scope 'inner_peace', foreløpig Kachow pal (0117). Lavere rating er vanligere, så
--   95 er sjeldnest: hvert kort vektes med 0,625 per rating over 88, og sjansen per trekk blir ca. 52 % for 88, 24 % for 89,
--   13 % for 90, 6 % for 91, 3 % for 92, 1,2 % for 93, 0,4 % for 94 og 0,2 % for 95. Det gir 90+ i ca. 24 %.
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
  ('messi', 95),             -- Lionel Messi, Oogway: mesteren
  ('olise', 94),                -- Michael Olise, Bayern München: FotMob 8,55 på 483 min, 5 mål og 2 assist (vanlig-kort 85)
  ('anis-hadj-moussa', 93),     -- Anis Hadj Moussa, Feyenoord: FotMob 8,25 på 706 min, 5 mål og 1 assist (vanlig-kort 77)
  ('vangelis-pavlidis', 93),    -- Vangelis Pavlidis, Benfica: FotMob 8,19 på 639 min, 8 mål og 3 assist (vanlig-kort 81)
  ('mbappe', 92),               -- Kylian Mbappé, Real Madrid: FotMob 8,10 på 720 min, 7 mål og 2 assist (vanlig-kort 91)
  ('patrick-berg', 92),         -- Patrick Berg, Bodø/Glimt: FotMob 7,85 på 1790 min, 2 mål og 2 assist (vanlig-kort 74)
  ('florian-thauvin', 92),      -- Florian Thauvin, Lens: FotMob 8,16 på 607 min, 3 mål og 6 assist (vanlig-kort 78)
  ('marco-grull', 91),          -- Marco Grüll, Werder Bremen: FotMob 8,15 på 535 min, 2 mål og 5 assist (vanlig-kort 73)
  ('aleksandar-pavlovic', 91),  -- Aleksandar Pavlović, Bayern München: FotMob 8,15 på 457 min, 2 mål og 1 assist (vanlig-kort 82)
  ('lamine-camara', 91),        -- Lamine Camara, Monaco: FotMob 8,01 på 540 min, 0 mål og 1 assist (vanlig-kort 79)
  ('pascal-gross', 91),         -- Pascal Groß, Brighton & Hove Albion: FotMob 7,98 på 540 min, 3 mål og 4 assist (vanlig-kort 80)
  ('waldemar-anton', 90),       -- Waldemar Anton, Borussia Dortmund: FotMob 7,97 på 540 min, 0 mål og 1 assist (vanlig-kort 82)
  ('paulo-dybala', 90),         -- Paulo Dybala, Roma: FotMob 7,99 på 496 min, 0 mål og 4 assist (vanlig-kort 81)
  ('morgan-rogers', 90),        -- Morgan Rogers, Chelsea: FotMob 7,90 på 613 min, 4 mål og 1 assist (vanlig-kort 83)
  ('alvaro-valles', 90),        -- Álvaro Vallés, Real Betis: FotMob 7,81 på 810 min, 0 mål og 0 assist (vanlig-kort 75)
  ('finn-dahmen', 90),          -- Finn Dahmen, Augsburg: FotMob 7,93 på 540 min, 0 mål og 0 assist (vanlig-kort 76)
  ('rayan-cherki', 89),         -- Rayan Cherki, Manchester City: FotMob 8,04 på 395 min, 4 mål og 2 assist (vanlig-kort 84)
  ('elia-caprile', 89),         -- Elia Caprile, Cagliari: FotMob 7,89 på 540 min, 0 mål og 0 assist (vanlig-kort 76)
  ('dayot-upamecano', 89),      -- Dayot Upamecano, Bayern München: FotMob 7,89 på 495 min, 1 mål og 0 assist (vanlig-kort 86)
  ('givairo-read', 89),         -- Givairo Read, Feyenoord: FotMob 7,72 på 751 min, 0 mål og 5 assist (vanlig-kort 74)
  ('patrik-schick', 89),        -- Patrik Schick, Bayer Leverkusen: FotMob 7,96 på 344 min, 5 mål og 1 assist (vanlig-kort 81)
  ('jacobo-ramon', 89),         -- Jacobo Ramón, Como: FotMob 7,74 på 540 min, 1 mål og 0 assist (vanlig-kort 75)
  ('joao-pedro', 88),           -- João Pedro, Chelsea: FotMob 7,74 på 521 min, 5 mål og 3 assist (vanlig-kort 82)
  ('oscar-gloukh', 88),         -- Oscar Gloukh, Ajax: FotMob 7,72 på 509 min, 1 mål og 4 assist (vanlig-kort 76)
  ('lassine-sinayoko', 88),     -- Lassine Sinayoko, Paris FC: FotMob 7,70 på 521 min, 4 mål og 1 assist (vanlig-kort 74)
  ('luis-diaz', 88),            -- Luis Díaz, Bayern München: FotMob 7,70 på 445 min, 4 mål og 1 assist (vanlig-kort 84)
  ('miguel-gutierrez', 88),     -- Miguel Gutiérrez, Bayer Leverkusen: FotMob 7,70 på 443 min, 1 mål og 3 assist (vanlig-kort 78)
  ('niclas-fullkrug', 88),      -- Niclas Füllkrug, Werder Bremen: FotMob 7,66 på 486 min, 6 mål og 0 assist (vanlig-kort 77)
  ('julian-brandt', 88),        -- Julian Brandt, Ajax: FotMob 7,63 på 531 min, 4 mål og 0 assist (vanlig-kort 84)
  ('kamory-doumbia', 88)       -- Kamory Doumbia, Brest: FotMob 7,60 på 568 min, 4 mål og 1 assist (vanlig-kort 72)
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
