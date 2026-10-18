-- Spesialkort, femte type: Inner Peace. 30 spillere på 88–95 som har roen, kontrollen og modenheten fra Kung Fu Panda:
-- Oogway (mesteren som aldri hastet), Shifu (kontroll som ble ro) og Po (han som fant seg selv og spilte fritt).
--   Oogway, de rolige mesterne (12): Messi 95, Rodri 94, Van Dijk 92, De Bruyne 92, Modrić 91, Alisson 90, Neuer 90,
--     Courtois 89, Rúben Dias 89, Marquinhos 89, Bernardo Silva 89, De Jong 88. Spillerne som setter tempoet og aldri
--     later til å ha det travelt, som Oogway under ferskentreet.
--   Shifu, kontroll som ble ro (9): Haaland 93, Kane 93, Ødegaard 92, Lewandowski 91, Kimmich 90, Rice 89, Saliba 89,
--     Griezmann 89, Son 88. Kapteiner og kyniske avsluttere som holder hodet kaldt når det gjelder. Haaland og Ødegaard
--     er også med fordi appen er norsk.
--   Po, fant seg selv og spilte fritt (9): Yamal 92, Dembélé 91, Raphinha 91, Pedri 90, Musiala 90, Wirtz 89, Vitinha 88,
--     Palmer 88, Saka 88. Dribblere og kreatører som spiller uten frykt, to av dem (Dembélé og Raphinha) etter år med
--     tvil og kritikk, som Po, som ikke var den alle ventet på, men likevel var det.
-- Rating:
-- * Ratingen er alltid over vanlig-kortet (boost minst 1), og går opp til 95 for Messi, mesteren. Alle stats får samme
--   løft som ratingen (maks 99), som for honorable mention. Kortet koster 2 ganger verdien på ratingen.
-- * Kortet trekkes bare av pakker med special_scope 'inner_peace', foreløpig Kachow pal (0117). Lavere rating er
--   vanligere, så 95 er sjeldnest: hvert kort vektes med 0,625 per rating over 88, og sjansen per trekk blir ca. 36 % for 88,
--   36 % for 89, 14 % for 90, 7 % for 91, 4 % for 92, 1,4 % for 93, 0,4 % for 94 og 0,3 % for 95. Det gir 90+ i ca. 28 %.
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
  ('messi', 95),             -- Lionel Messi
  ('rodri', 94),             -- Rodri
  ('haaland', 93),           -- Erling Haaland
  ('kane', 93),              -- Harry Kane
  ('odegaard', 92),          -- Martin Ødegaard
  ('lamine-yamal', 92),      -- Lamine Yamal
  ('van-dijk', 92),          -- Virgil van Dijk
  ('de-bruyne', 92),         -- Kevin De Bruyne
  ('dembele', 91),           -- Ousmane Dembélé
  ('raphinha', 91),          -- Raphinha
  ('luka-modric', 91),       -- Luka Modrić
  ('lewandowski', 91),       -- Robert Lewandowski
  ('pedri', 90),             -- Pedri
  ('musiala', 90),           -- Jamal Musiala
  ('alisson', 90),           -- Alisson
  ('manuel-neuer', 90),      -- Manuel Neuer
  ('kimmich', 90),           -- Joshua Kimmich
  ('wirtz', 89),             -- Florian Wirtz
  ('courtois', 89),          -- Thibaut Courtois
  ('ruben-dias', 89),        -- Rúben Dias
  ('marquinhos', 89),        -- Marquinhos
  ('saliba', 89),            -- William Saliba
  ('bernardo-silva', 89),    -- Bernardo Silva
  ('declan-rice', 89),       -- Declan Rice
  ('antoine-griezmann', 89), -- Antoine Griezmann
  ('vitinha', 88),           -- Vitinha
  ('palmer', 88),            -- Cole Palmer
  ('son', 88),               -- Heung-Min Son
  ('saka', 88),              -- Bukayo Saka
  ('de-jong', 88)            -- Frenkie de Jong
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
