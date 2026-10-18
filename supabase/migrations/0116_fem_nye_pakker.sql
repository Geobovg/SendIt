-- Fem nye pakker i butikken, så MB har noe å brukes på mellom 150 og 3000 MB. Hullet mellom Premium gull (100) og
-- Sjeldne spillere (200) fylles også, og over Skadoosh dude (1000) kommer to pakker som jakter på Icon og TOTS.
--   Gullrush        150 MB   5 kort, alle 78+, garantert to på 80+ og ett på 83+.
--   Stjerneutvalg   500 MB   8 kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.
--   Formpakka       750 MB   Ett garantert spesialkort (inform eller honorable mention) og fem kort på 83+, garantert
--                            ett på 86+ og to på 84+. Maks 3 per dag.
--   Ikonjakt       1500 MB   6 kort, alle 86+, garantert to på 88+, og ca. 17 % sjanse for en Icon. Maks 2 per dag.
--   Legendepakka   3000 MB   Ett garantert TOTS-kort og elleve kort på 86+, garantert ett på 90+ og tre på 88+, og ca. 33 %
--                            sjanse for en Icon. Maks 1 per dag.
-- Alle bruker mekanikkene som finnes fra før (sjikt, garantier, inform/honorable/Icon-sjanser og kjøpsgrense per dag),
-- så ingenting i pakkeåpningen er endret. Pakkene sorteres etter pris, så sort_order på de gamle er nummerert på nytt.
--
-- Simulert sjanse for minst ett vanlig kort (ikke inform, honorable, Icon eller TOTS) per pakke, og snittrating. Tallene
-- ved sjiktkantene (83+, 84+, 86+, 88+, 90+) avhenger ikke av hvor mange kort katalogen har per rating. Snittet gjør det,
-- så det er regnet ut med en antatt fordeling, og simulatoren traff Sjeldne spillere i 0100 (82,8 mot 82,9).
--                         snitt   84+      86+      88+      90+      Icon     inform
--   Gullrush (150)        81,0    43,1 %   11,5 %   2,3 %    0,4 %    -        4,9 %
--   Stjerneutvalg (500)   84,3    100 %    100 %    47,3 %   6,6 %    -        21,5 %
--   Formpakka (750)       85,8    100 %    100 %    48,6 %   14,2 %   -        9,4 %   (pluss ett garantert spesialkort)
--   Ikonjakt (1500)       87,6    100 %    100 %    100 %    56,6 %   16,7 %   24,2 %
--   Legendepakka (3000)   88,2    100 %    100 %    100 %    100 %    32,8 %   44,6 %  (pluss ett garantert TOTS-kort)
-- Hurtigsalg gir 25 % av kortets verdi (30 % for inform), så de nye pakkene gir ca. 55–70 % av prisen tilbake hvis man
-- selger alt. Det er under Skadoosh dude, som ligger tett på prisen, så pakkene holder MB ute av omløp, og ingen kan
-- tjene på å åpne og selge.

-- 1) Pakkene sorteres etter pris i butikken.
update manager_packs set sort_order = case key
  when 'gullpakke' then 1 when 'gull_spillere' then 2 when 'premium_gull' then 3
  when 'sjeldne_spillere' then 5 when 'jumbo_premium_gull' then 6 when 'skadoosh_dude' then 9
end
where key in ('gullpakke', 'gull_spillere', 'premium_gull', 'sjeldne_spillere', 'jumbo_premium_gull', 'skadoosh_dude');

-- 2) De fem nye pakkene. Formpakka og Legendepakka har ett garantert spesialkort (special_guarantee), som kommer i
-- tillegg til de andre kortene og telles med i card_count. Spesialkortet i Formpakka er inform eller honorable mention
-- (scope 'mix', se 0114), og i Legendepakka et TOTS-kort. Oddsen er vekter per sjikt (se 0034).
insert into manager_packs (key, name, description, price, card_count, guarantee_min, guarantee_count, guarantees, odds, accent, sort_order,
  inform_chance, tots_chance, icon_chance, honorable_chance, special_guarantee, special_scope, purchasable, weekly_limit, daily_purchase_limit, untradable, daily_limit, available_from, available_until) values
  ('gullrush', 'Gullrush', 'Fem kort, alle 78+, garantert to på 80+ og ett på 83+.', 150, 5, 80, 3,
    '[{"min":83,"count":1},{"min":80,"count":2}]',
    '[{"min":78,"max":79,"weight":36},{"min":80,"max":82,"weight":48},{"min":83,"max":83,"weight":10},{"min":84,"max":85,"weight":4.5},{"min":86,"max":87,"weight":1.2},{"min":88,"max":89,"weight":0.25},{"min":90,"max":99,"weight":0.05}]',
    '#f4a261', 4, 0.01, 0, 0, 0.002, 0, 'current', true, null, null, false, null, null, null),
  ('stjerneutvalg', 'Stjerneutvalg', 'Åtte kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.', 500, 8, 85, 3,
    '[{"min":87,"count":1},{"min":85,"count":2}]',
    '[{"min":82,"max":82,"weight":34},{"min":83,"max":83,"weight":26},{"min":84,"max":84,"weight":16},{"min":85,"max":85,"weight":12},{"min":86,"max":86,"weight":6.5},{"min":87,"max":87,"weight":3.2},{"min":88,"max":89,"weight":2},{"min":90,"max":99,"weight":0.3}]',
    '#60a5fa', 7, 0.03, 0, 0, 0.01, 0, 'current', true, null, 3, false, null, null, null),
  ('formpakka', 'Formpakka', 'Ett spesialkort (inform eller honorable mention) og fem kort på 83+, garantert ett på 86+ og to på 84+. Maks 3 per dag.', 750, 6, 84, 3,
    '[{"min":86,"count":1},{"min":84,"count":2}]',
    '[{"min":83,"max":83,"weight":22},{"min":84,"max":84,"weight":20},{"min":85,"max":85,"weight":18},{"min":86,"max":86,"weight":17},{"min":87,"max":87,"weight":11},{"min":88,"max":89,"weight":9},{"min":90,"max":99,"weight":3}]',
    '#34d399', 8, 0.02, 0, 0, 0.01, 1, 'mix', true, null, 3, false, null, null, null),
  ('ikonjakt', 'Ikonjakt', 'Seks kort, alle 86+, garantert to på 88+, og ca. 17 % sjanse for en Icon. Maks 2 per dag.', 1500, 6, 88, 2,
    '[{"min":88,"count":2}]',
    '[{"min":86,"max":86,"weight":34},{"min":87,"max":87,"weight":26},{"min":88,"max":88,"weight":17},{"min":89,"max":89,"weight":11},{"min":90,"max":90,"weight":7},{"min":91,"max":91,"weight":3},{"min":92,"max":99,"weight":2}]',
    '#a78bfa', 10, 0.05, 0, 0.03, 0.04, 0, 'current', true, null, 2, false, null, null, null),
  ('legendepakka', 'Legendepakka', 'Tolv kort: ett TOTS-kort og elleve på 86+, garantert ett på 90+ og tre på 88+. Ca. 33 % sjanse for en Icon. Maks 1 per dag.', 3000, 12, 88, 4,
    '[{"min":90,"count":1},{"min":88,"count":3}]',
    '[{"min":86,"max":86,"weight":22},{"min":87,"max":87,"weight":20},{"min":88,"max":88,"weight":20},{"min":89,"max":89,"weight":14},{"min":90,"max":90,"weight":12},{"min":91,"max":91,"weight":6},{"min":92,"max":99,"weight":6}]',
    '#f43f5e', 11, 0.06, 0, 0.035, 0.06, 1, 'tots', true, null, 1, false, null, null, null)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price = excluded.price, card_count = excluded.card_count,
  guarantee_min = excluded.guarantee_min, guarantee_count = excluded.guarantee_count, guarantees = excluded.guarantees, odds = excluded.odds,
  accent = excluded.accent, sort_order = excluded.sort_order, inform_chance = excluded.inform_chance, tots_chance = excluded.tots_chance,
  icon_chance = excluded.icon_chance, honorable_chance = excluded.honorable_chance, special_guarantee = excluded.special_guarantee,
  special_scope = excluded.special_scope, purchasable = excluded.purchasable, weekly_limit = excluded.weekly_limit,
  daily_purchase_limit = excluded.daily_purchase_limit, untradable = excluded.untradable, daily_limit = excluded.daily_limit,
  available_from = excluded.available_from, available_until = excluded.available_until, active = true;
