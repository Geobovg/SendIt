-- Ni nye Icons (legender) i tillegg til de 20 fra 0074: Hazard, Marcelo, Iniesta, Chiellini, David Villa, Busquets,
-- Nani, Özil og Totti. De legges inn på samme måte som de første: active = false i katalogen, liga 'icons', klubb 'Icons',
-- og et kort i den eksisterende Icon-runden (boost 0, pris 2,5 ganger verdien). Pakkene trekker jevnt blant alle
-- Icon-kort, så de nye kan trekkes uten at funksjonene endres.
-- Nasjonene står også i src/lib/player-nationalities.ts.

with icons (slug, name, position, overall, nation, pace, shooting, passing, dribbling, defending, physical) as (values
  ('icon-iniesta',   'Andrés Iniesta',    'CM',  93, 'es', 72, 78, 94, 95, 66, 62),
  ('icon-hazard',    'Eden Hazard',       'LW',  91, 'be', 90, 85, 88, 95, 40, 66),
  ('icon-totti',     'Francesco Totti',   'ST',  90, 'it', 70, 90, 91, 90, 40, 72),
  ('icon-ozil',      'Mesut Özil',        'CAM', 90, 'de', 74, 83, 95, 91, 40, 58),
  ('icon-busquets',  'Sergio Busquets',   'CDM', 90, 'es', 50, 62, 90, 84, 88, 80),
  ('icon-marcelo',   'Marcelo',           'LB',  90, 'br', 85, 76, 85, 88, 80, 78),
  ('icon-david-villa', 'David Villa',     'ST',  89, 'es', 85, 92, 80, 88, 38, 74),
  ('icon-chiellini', 'Giorgio Chiellini', 'CB',  89, 'it', 70, 48, 62, 66, 94, 88),
  ('icon-nani',      'Nani',              'RW',  89, 'pt', 90, 83, 85, 91, 40, 72)
)
insert into player_catalog (slug, name, position, overall, price, attributes, accent, active, club, league, nation)
select slug, name, position, overall, public.card_value_for_overall(overall),
  jsonb_build_object('pace', pace, 'shooting', shooting, 'passing', passing, 'dribbling', dribbling, 'defending', defending, 'physical', physical),
  '#d4af37', false, 'Icons', 'icons', nation
from icons
on conflict (slug) do nothing;

insert into special_cards (round_id, kind, catalog_id, overall, boost, attributes, price)
select round.id, 'icon', catalog.id, catalog.overall, 0, catalog.attributes, ceil(public.card_value_for_overall(catalog.overall) * 2.5)::integer
from player_catalog catalog
cross join (select id from special_rounds where kind = 'icon' and starts_at = '2026-10-08 00:00:00+02') round
where catalog.league = 'icons' and not catalog.active
on conflict (round_id, catalog_id) do nothing;

-- Med 29 i stedet for 20 Icons blir hver enkelt Icon sjeldnere ved samme sjanse. Icon-sjansen per kort løftes derfor
-- med omtrent 15 % (fra 0104 og 0105), så det fortsatt er veldig sjeldent å få en Icon.
update manager_packs set icon_chance = 0.00012 where key = 'gullpakke';
update manager_packs set icon_chance = 0.00023 where key = 'gull_spillere';
update manager_packs set icon_chance = 0.00035 where key = 'premium_gull';
update manager_packs set icon_chance = 0.0007 where key = 'sjeldne_spillere';
update manager_packs set icon_chance = 0.0007 where key = 'jumbo_premium_gull';
update manager_packs set icon_chance = 0.0023 where key = 'skadoosh_dude';
