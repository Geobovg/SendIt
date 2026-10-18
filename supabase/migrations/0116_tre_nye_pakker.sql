-- Tre nye pakker i butikken, så MB har noe å brukes på mellom 500 og 2000 MB:
--   Stjerneutvalg   500 MB   8 kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.
--   Formpakka       750 MB   Ett garantert spesialkort (inform eller honorable mention) og fem kort på 83+, garantert
--                            ett på 86+ og to på 84+. Maks 3 per dag.
--   Ikonjakt       2000 MB   8 kort, alle 86+, garantert tre på 88+, og ca. 22 % sjanse for en Icon. Maks 1 per dag.
-- Alle bruker mekanikkene som finnes fra før (sjikt, garantier, inform/honorable/Icon-sjanser og kjøpsgrense per dag),
-- så ingenting i pakkeåpningen er endret. Pakkene sorteres etter pris, så Skadoosh dude (1000 MB) får nytt sort_order.
--
-- Simulert sjanse for minst ett vanlig kort (ikke inform, honorable eller Icon) per pakke, og snittrating. Tallene
-- ved sjiktkantene (84+, 86+, 88+, 90+) avhenger ikke av hvor mange kort katalogen har per rating. Snittet gjør det,
-- så det er regnet ut med en antatt fordeling, og simulatoren traff Sjeldne spillere i 0100 (82,8 mot 82,9).
--                         snitt   84+      86+      88+      90+      Icon     inform
--   Stjerneutvalg (500)   84,3    100 %    100 %    47,3 %   6,6 %    -        21,5 %
--   Formpakka (750)       85,8    100 %    100 %    48,6 %   14,2 %   -        9,4 %   (pluss ett garantert spesialkort)
--   Ikonjakt (2000)       87,7    100 %    100 %    100 %    65,5 %   21,8 %   30,8 %
-- Til sammenligning har Skadoosh dude (1000 MB, 15 kort): snitt 85,7, 90+ i 44,6 % av pakkene og Icon i 3 %. Ikonjakt har
-- færre kort, men bedre kort, og et godt stykke bedre sjanse for 90+ og Icon, uten garantert 90+.
-- Hurtigsalg gir 25 % av kortets verdi (30 % for inform), så pakkene gir ca. 50–65 % av prisen tilbake hvis man selger
-- alt. Det er under Skadoosh dude, som ligger tett på prisen, så pakkene holder MB ute av omløp, og ingen kan tjene
-- på å åpne og selge.

-- 1) Pakkene sorteres etter pris i butikken.
update manager_packs set sort_order = 8 where key = 'skadoosh_dude';

-- 2) De tre nye pakkene. Formpakka har ett garantert spesialkort (special_guarantee), som kommer i tillegg til de
-- andre kortene og telles med i card_count. Spesialkortet er inform eller honorable mention (scope 'mix', se 0114).
-- Oddsen er vekter per sjikt (se 0034).
insert into manager_packs (key, name, description, price, card_count, guarantee_min, guarantee_count, guarantees, odds, accent, sort_order,
  inform_chance, tots_chance, icon_chance, honorable_chance, special_guarantee, special_scope, purchasable, weekly_limit, daily_purchase_limit, untradable, daily_limit, available_from, available_until) values
  ('stjerneutvalg', 'Stjerneutvalg', 'Åtte kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.', 500, 8, 85, 3,
    '[{"min":87,"count":1},{"min":85,"count":2}]',
    '[{"min":82,"max":82,"weight":34},{"min":83,"max":83,"weight":26},{"min":84,"max":84,"weight":16},{"min":85,"max":85,"weight":12},{"min":86,"max":86,"weight":6.5},{"min":87,"max":87,"weight":3.2},{"min":88,"max":89,"weight":2},{"min":90,"max":99,"weight":0.3}]',
    '#60a5fa', 6, 0.03, 0, 0, 0.01, 0, 'current', true, null, 3, false, null, null, null),
  ('formpakka', 'Formpakka', 'Ett spesialkort (inform eller honorable mention) og fem kort på 83+, garantert ett på 86+ og to på 84+. Maks 3 per dag.', 750, 6, 84, 3,
    '[{"min":86,"count":1},{"min":84,"count":2}]',
    '[{"min":83,"max":83,"weight":22},{"min":84,"max":84,"weight":20},{"min":85,"max":85,"weight":18},{"min":86,"max":86,"weight":17},{"min":87,"max":87,"weight":11},{"min":88,"max":89,"weight":9},{"min":90,"max":99,"weight":3}]',
    '#34d399', 7, 0.02, 0, 0, 0.01, 1, 'mix', true, null, 3, false, null, null, null),
  ('ikonjakt', 'Ikonjakt', 'Åtte kort, alle 86+, garantert tre på 88+, og ca. 22 % sjanse for en Icon. Maks 1 per dag.', 2000, 8, 88, 3,
    '[{"min":88,"count":3}]',
    '[{"min":86,"max":86,"weight":34},{"min":87,"max":87,"weight":27},{"min":88,"max":88,"weight":17},{"min":89,"max":89,"weight":11},{"min":90,"max":90,"weight":6},{"min":91,"max":91,"weight":3},{"min":92,"max":99,"weight":2}]',
    '#a78bfa', 9, 0.05, 0, 0.03, 0.04, 0, 'current', true, null, 1, false, null, null, null)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price = excluded.price, card_count = excluded.card_count,
  guarantee_min = excluded.guarantee_min, guarantee_count = excluded.guarantee_count, guarantees = excluded.guarantees, odds = excluded.odds,
  accent = excluded.accent, sort_order = excluded.sort_order, inform_chance = excluded.inform_chance, tots_chance = excluded.tots_chance,
  icon_chance = excluded.icon_chance, honorable_chance = excluded.honorable_chance, special_guarantee = excluded.special_guarantee,
  special_scope = excluded.special_scope, purchasable = excluded.purchasable, weekly_limit = excluded.weekly_limit,
  daily_purchase_limit = excluded.daily_purchase_limit, untradable = excluded.untradable, daily_limit = excluded.daily_limit,
  available_from = excluded.available_from, available_until = excluded.available_until, active = true;
