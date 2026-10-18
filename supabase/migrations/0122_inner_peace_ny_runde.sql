-- Inner Peace, ny runde med det endelige utvalget. PR #177 (0116 og 0117) ble merget og kjørt i produksjon før de siste justeringene,
-- så databasen har den første utgaven (Eredivisie- og Liga Portugal-spillere, Thauvin, Mbappé og tre mindre kjente keepere). 0116 kan
-- ikke endres etter at den er på main, så alt gjøres her:
-- * De 34 endelige kortene legges i en ny Inner Peace-runde. Pakker trekker bare fra den nyeste runden.
-- * De 20 spillerne som bare var i den første utgaven (Thauvin, Mbappé, Pavlidis, Hadj Moussa og de andre) tas ut nå, også hos de som
--   har fått kortet. Eierne mister kortet og får ingen erstatning og ingen MB tilbake. Kortet fjernes fra elleveren og benken (som når et
--   kort selges), og en aktiv annonse på markedet for det forsvinner med det.
-- * Kort som fortsatt er med i spillet beholdes. Det gjelder de 10 spillerne som er med i begge utgavene (Messi, Olise, Berg, Pavlović,
--   Camara, Dybala, Rogers, Cherki, João Pedro og Luis Díaz): eierne beholder kortet de har, også der ratingen er endret i det nye utvalget.
--   Kort fra den første runden som ingen eier, slettes.
-- Utvalget (valgt 18.10.2026, se 0116 for metoden): Messi er beholdt på 95 som Oogway. De 33 andre er kjente og lovende spillere fra de fem
-- store ligaene (Premier League, LaLiga, Serie A, Bundesliga og Ligue 1), pluss nordmenn, som har gjort det best i år ifølge FotMob, med
-- best rating til de beste. Ratingen følger FotMobs snittrating i hovedserien for 2026/27, justert for spilletid ved at ratingen trekkes
-- mot 6,9 med en vekt på 360 minutter, minst 300 minutter. «Kjent» og «lovende» er vurdert ut fra markedsverdi, alder og navn på FotMob.
-- Ingen får mer enn 11 over vanlig-kortet, bortsett fra Patrick Berg (+16, 1790 minutter i Eliteserien) og Ajer (+13), og Ødegaard får +3. Ødegaard (93),
-- Berg (90), Pavlović (89), Nusa (92), Joan García (91), Guéhi (90), Doué (92), Torres (90), Mainoo (91), Fermín López (90), Güler (90),
-- Maguire (91) og Ajer (89) har fått rating for hånd. Maguire (+11) og Ajer (+13, Brentford) er lagt til som midtstoppere, siden Guéhi ellers er
-- den eneste. Cubarsí, Nico Paz og Huijsen er ikke med, siden de allerede har et honorable mention-kort (Nusa har det også, men beholdes).
-- Mbeumo (89) og Ekitiké (90) kom inn for Cubarsí og Paz. Ekitiké har ikke spilt i 2026/27 (aktillesskade), så ratingen hans bygger på
-- sesongen før. TOTS regnes ikke som spesialkort her, og informs er ikke vurdert. Alle stats får samme løft som ratingen (maks 99).
-- Kortet koster 2 ganger verdien på ratingen. Stats regnes fra katalogen slik den er nå, altså etter FotMob-justeringen i 0121.
-- Fordeling: 95 (1), 94 (1), 93 (1), 92 (3), 91 (5), 90 (10), 89 (8) og 88 (5). Lavere rating er vanligere i trekningen (vekt 0,625 per
-- rating over 88), så sjansen per trekk er ca. 32 % for 88, 32 % for 89, 25 % for 90, 7,7 % for 91, 2,9 % for 92, 0,6 % for 93, 0,4 % for 94
-- og 0,2 % for 95. Det gir 90+ i ca. 37 %.
-- Om Kachow pal (0117): kortene i pakka er verdt ca. 5200 MB til katalogpris (ca. 149 % av prisen på 3500 MB), men hurtigsalg gir bare 25 %
-- av verdien, og dermed ca. 1300 MB (ca. 37–38 %). Hvor mye man får for kortene på overgangsmarkedet, avhenger av prisene folk betaler der.
-- Hvis en av spillerne ikke finnes i katalogen, feiler migreringen i stedet for å lage færre enn 34 kort.

-- 1) Den nye runden. Pakkene trekker bare fra den nyeste Inner Peace-runden (se 4).
insert into special_rounds (kind, starts_at, ends_at) values ('inner_peace', '2026-10-18 17:00:00+02', '2100-01-01 00:00:00+00')
on conflict (kind, starts_at) do nothing;

with picks (slug, overall) as (values
  ('messi', 95),                      -- Lionel Messi, Oogway: mesteren
  ('olise', 94),                      -- Michael Olise, Bayern München, 24 år: FotMob 8,55 på 483 min, 5 mål og 2 assist (vanlig-kort 85)
  ('odegaard', 93),                   -- Martin Ødegaard, Arsenal, 27 år, nordmann: FotMob 7,55 på 471 min, 2 mål og 0 assist (vanlig-kort 90)
  ('paulo-dybala', 92),               -- Paulo Dybala, Roma, 32 år: FotMob 7,99 på 496 min, 0 mål og 4 assist (vanlig-kort 81)
  ('nusa', 92),                       -- Antonio Nusa, RB Leipzig, 21 år, nordmann: FotMob 7,79 på 466 min, 3 mål og 3 assist (vanlig-kort 83)
  ('desire-doue', 92),                -- Désiré Doué, Paris Saint-Germain, 21 år: FotMob 7,20 på 355 min, 1 mål og 1 assist (vanlig-kort 85)
  ('morgan-rogers', 91),              -- Morgan Rogers, Chelsea, 24 år: FotMob 7,90 på 613 min, 4 mål og 1 assist (vanlig-kort 83)
  ('rayan-cherki', 91),               -- Rayan Cherki, Manchester City, 23 år: FotMob 8,04 på 395 min, 4 mål og 2 assist (vanlig-kort 84)
  ('joan-garcia', 91),                -- Joan García, Barcelona, 25 år: FotMob 7,18 på 675 min, 0 mål og 0 assist (vanlig-kort 82)
  ('kobbie-mainoo', 91),              -- Kobbie Mainoo, Manchester United, 21 år: FotMob 7,49 på 447 min, 0 mål og 1 assist (vanlig-kort 82)
  ('harry-maguire', 91),              -- Harry Maguire, Manchester United, 33 år: FotMob 7,10 på 540 min, 0 mål og 0 assist (vanlig-kort 80)
  ('lamine-camara', 90),              -- Lamine Camara, Monaco, 22 år: FotMob 8,01 på 540 min, 0 mål og 1 assist (vanlig-kort 79)
  ('davies', 90),                     -- Alphonso Davies, Bayern München, 25 år: FotMob 8,02 på 362 min, 0 mål og 2 assist (vanlig-kort 84)
  ('joao-pedro', 90),                 -- João Pedro, Chelsea, 25 år: FotMob 7,74 på 521 min, 5 mål og 3 assist (vanlig-kort 82)
  ('luis-diaz', 90),                  -- Luis Díaz, Bayern München, 29 år: FotMob 7,70 på 445 min, 4 mål og 1 assist (vanlig-kort 84)
  ('patrick-berg', 90),               -- Patrick Berg, Bodø/Glimt, 28 år, nordmann: FotMob 7,85 på 1790 min, 2 mål og 2 assist (vanlig-kort 74)
  ('fermin-lopez', 90),               -- Fermín López, Barcelona, 23 år: FotMob 7,63 på 538 min, 4 mål og 3 assist (vanlig-kort 82)
  ('arda-guler', 90),                 -- Arda Güler, Real Madrid, 21 år: FotMob 7,62 på 426 min, 1 mål og 2 assist (vanlig-kort 84)
  ('ekitike', 90),                    -- Hugo Ekitiké, Liverpool, 24 år: ingen kamper i 2026/27 (aktillesskade, tilbake tidlig i januar 2027), men 11 mål og FotMob 7,11 på 1810 min i Premier League 2025/26 (vanlig-kort 81)
  ('marc-guehi', 90),                 -- Marc Guéhi, Manchester City, 26 år: FotMob 7,65 på 630 min, 1 mål og 1 assist (vanlig-kort 84)
  ('ferran-torres', 90),              -- Ferran Torres, Paris Saint-Germain, 26 år: FotMob 7,20 på 432 min, 4 mål og 1 assist (vanlig-kort 83)
  ('aleksandar-pavlovic', 89),        -- Aleksandar Pavlović, Bayern München, 22 år: FotMob 8,15 på 457 min, 2 mål og 1 assist (vanlig-kort 82)
  ('jens-petter-hauge', 89),          -- Jens Petter Hauge, Bodø/Glimt, 27 år, nordmann: FotMob 7,69 på 1287 min, 5 mål og 4 assist (vanlig-kort 78)
  ('pierre-emerick-aubameyang', 89),  -- Pierre-Emerick Aubameyang, Deportivo A Coruña, 37 år: FotMob 7,70 på 560 min, 5 mål og 2 assist (vanlig-kort 78)
  ('elliot-anderson', 89),            -- Elliot Anderson, Manchester City, 23 år: FotMob 7,55 på 518 min, 0 mål og 1 assist (vanlig-kort 83)
  ('jobe-bellingham', 89),            -- Jobe Bellingham, Borussia Dortmund, 21 år: FotMob 7,52 på 460 min, 0 mål og 1 assist (vanlig-kort 78)
  ('lewis-hall', 89),                 -- Lewis Hall, Newcastle United, 22 år: FotMob 7,42 på 629 min, 1 mål og 1 assist (vanlig-kort 79)
  ('bryan-mbeumo', 89),               -- Bryan Mbeumo, Manchester United, 27 år: FotMob 7,50 på 540 min, 3 mål og 0 assist (vanlig-kort 84)
  ('ajer', 89),                       -- Kristoffer Ajer, Brentford, 28 år, nordmann: FotMob 7,29 på 630 min, 1 mål og 0 assist (vanlig-kort 76)
  ('james-trafford', 88),             -- James Trafford, Leeds United, 24 år: FotMob 7,38 på 540 min, 0 mål og 0 assist (vanlig-kort 80)
  ('can-uzun', 88),                   -- Can Uzun, Eintracht Frankfurt, 20 år: FotMob 7,43 på 414 min, 2 mål og 0 assist (vanlig-kort 78)
  ('francisco-conceicao', 88),        -- Francisco Conceição, Juventus, 23 år: FotMob 7,30 på 409 min, 1 mål og 1 assist (vanlig-kort 82)
  ('franco-mastantuono', 88),         -- Franco Mastantuono, Fiorentina, 19 år: FotMob 7,22 på 467 min, 3 mål og 0 assist (vanlig-kort 78)
  ('yan-diomande', 88)                -- Yan Diomande, Real Madrid, 19 år: FotMob 7,18 på 366 min, 1 mål og 1 assist (vanlig-kort 77)
)
insert into special_cards (round_id, kind, catalog_id, overall, boost, attributes, price)
select round.id, 'inner_peace', catalog.id, rating.overall, rating.overall - catalog.overall,
  coalesce((select jsonb_object_agg(attribute.key, least(99, attribute.value::integer + rating.overall - catalog.overall)) from jsonb_each_text(catalog.attributes) as attribute), '{}'::jsonb),
  ceil(public.card_value_for_overall(rating.overall) * 2)::integer
from picks
join player_catalog catalog on catalog.slug = picks.slug
cross join lateral (select greatest(picks.overall, catalog.overall + 1) as overall) rating
cross join (select id from special_rounds where kind = 'inner_peace' and starts_at = '2026-10-18 17:00:00+02') round
on conflict (round_id, catalog_id) do nothing;

do $fn$
declare
  found_cards integer := (select count(*) from special_cards where round_id = (select id from special_rounds where kind = 'inner_peace' and starts_at = '2026-10-18 17:00:00+02'));
begin
  if found_cards <> 34 then raise exception 'Forventet 34 Inner Peace-kort i den nye runden, men fant %. Mangler en av spillerne i katalogen?', found_cards; end if;
end;
$fn$;

-- 2) Fjerning hos eierne. Et kort fra den første runden er fjernet hvis spilleren ikke er med i den nye runden (de 20 som bare var i den
-- første utgaven). Eieren mister kortet uten erstatning og uten refusjon. Kort av spillere som er med i begge utgavene er urørt.
-- Kortet tas ut av elleveren og benken først (som i quick_sell_manager_card), og selve kortet slettes. Annonser, bud og andre rader som peker på
-- kortet slettes med det (on delete cascade).
do $fn$
declare
  old_round uuid := (select id from special_rounds where kind = 'inner_peace' and starts_at = '2026-10-18 00:00:00+02');
  new_round uuid := (select id from special_rounds where kind = 'inner_peace' and starts_at = '2026-10-18 17:00:00+02');
  owned record;
  removed integer := 0;
begin
  for owned in
    select card.id, card.owner_id
    from manager_cards card
    join special_cards old_card on old_card.id = card.special_card_id
    where old_card.round_id = old_round
      and old_card.catalog_id not in (select catalog_id from special_cards where round_id = new_round)
  loop
    perform public.drop_card_from_lineup(owned.owner_id, owned.id);
    delete from manager_cards where id = owned.id;
    removed := removed + 1;
  end loop;
  raise notice 'Fjernet % Inner Peace-kort fra den første runden', removed;
end;
$fn$;

-- 3) Kort fra den første runden (0116) som ingen eier, slettes. Eide kort fra de ti spillerne som er med i begge utgavene er urørt.
delete from special_cards card
where card.kind = 'inner_peace'
  and card.round_id = (select id from special_rounds where kind = 'inner_peace' and starts_at = '2026-10-18 00:00:00+02')
  and not exists (select 1 from manager_cards owned where owned.special_card_id = card.id);

-- 4) Scope 'inner_peace' trekker bare fra den nyeste runden, vektet etter rating (0,625 per rating over 88). Resten er lik versjonen i 0116,
-- så 'mix' og alle de andre scopene virker som før. Skal funksjonen skrives om senere, må 'inner_peace' tas med.
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
    where kind = 'inner_peace'
      and round_id = (select id from special_rounds where kind = 'inner_peace' order by starts_at desc limit 1)
      and id <> all(coalesce(excluded, '{}'))
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
