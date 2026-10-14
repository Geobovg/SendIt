-- 1) Jumbo premium gull (300 MB) har åtte kort i stedet for tolv. Prisen, garantiene (tre på 80+ og ett på 83+) og
-- sannsynlighetene per kort er uendret, så kortene er like gode hver for seg, men det blir færre av dem.
-- Simulert sjanse for minst ett kort i pakka (før med tolv kort → nå med åtte):
--   84+: 100 % → 100 %   86+: 99 % → 95 %   88+: 76 % → 62 %   90+: 30 % → 21 %
-- Sjeldne spillere (200 MB, fem kort) er fortsatt tydelig dårligere: 86+ 62 %, 88+ 26 %, 90+ 6 %.
-- Sjansen for inform og honorable gjelder hvert kort som ikke er garantert. Med åtte kort er fire garantert, så
-- fire kort kan bli spesialkort, og hvert av dem får høyere sjanse (8 / 4 i stedet for 12 / 8 av kortene).

update manager_packs set
  card_count = 8,
  description = 'Åtte kort, alle 79+, garantert tre på 80+ og ett på 83+. Maks 3 per dag.'
where key = 'jumbo_premium_gull';

-- 2) Ny pakke over Jumbo: «Skadoosh dude», 1000 MB, 15 kort. Alle kortene er 80+, og garantert ett på 88+, to på 86+
-- og fire på 84+. Sannsynlighetene per kort er klart bedre enn i Jumbo (snitt 86,0 mot 84,5), og inform, honorable
-- og Icon er også mer sannsynlige. Ingen kjøpsgrense: prisen holder den sjelden. Simulert sjanse for minst ett kort
-- med 90+ i pakka er omtrent 55 %, mot 21 % i Jumbo.
insert into manager_packs (key, name, description, price, card_count, guarantee_min, guarantee_count, guarantees, odds, accent, sort_order,
  inform_chance, tots_chance, icon_chance, honorable_chance, special_guarantee, special_scope, purchasable, active) values
  ('skadoosh_dude', 'Skadoosh dude', 'Femten kort, alle 80+, garantert ett på 88+, to på 86+ og fire på 84+.', 1000, 15, 84, 7,
    '[{"min":88,"count":1},{"min":86,"count":2},{"min":84,"count":4}]',
    '[{"min":80,"max":82,"weight":6},{"min":83,"max":83,"weight":12},{"min":84,"max":85,"weight":30},{"min":86,"max":87,"weight":31},{"min":88,"max":89,"weight":16},{"min":90,"max":99,"weight":5}]',
    '#22d3ee', 6, 0.08, 0, 0.002, 0.07, 0, 'current', true, true)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price = excluded.price, card_count = excluded.card_count,
  guarantee_min = excluded.guarantee_min, guarantee_count = excluded.guarantee_count, guarantees = excluded.guarantees, odds = excluded.odds,
  accent = excluded.accent, sort_order = excluded.sort_order, inform_chance = excluded.inform_chance, tots_chance = excluded.tots_chance,
  icon_chance = excluded.icon_chance, honorable_chance = excluded.honorable_chance, special_guarantee = excluded.special_guarantee,
  special_scope = excluded.special_scope, purchasable = excluded.purchasable, active = excluded.active;
