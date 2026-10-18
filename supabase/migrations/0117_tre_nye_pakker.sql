-- Tre nye pakker i butikken, så MB har noe å brukes på mellom 500 og 3500 MB, og Skadoosh dude blir dyrere:
--   Stjerneutvalg   500 MB   8 kort, alle 82+, garantert ett på 87+ og to på 85+. Maks 3 per dag.
--   Formpakka       750 MB   Ett garantert spesialkort (inform eller honorable mention) og fem kort på 83+, garantert
--                            ett på 86+ og to på 84+. Maks 3 per dag.
--   Skadoosh dude  1500 MB   Uendret, men prisen går opp fra 1000 MB. Fortsatt maks 1 per dag.
--   Kachow pal     3500 MB   Ett garantert Inner Peace-kort (88–95, se 0116) og åtte kort på 86+, garantert ett på 90+ og to
--                            på 88+, og ca. 9 % sjanse for en Icon. Maks 1 per dag.
-- Alle bruker mekanikkene som finnes fra før (sjikt, garantier, inform/honorable/Icon-sjanser og kjøpsgrense per dag),
-- så ingenting i pakkeåpningen er endret. Pakkene sorteres etter pris, så Skadoosh dude får nytt sort_order.
--
-- Simulert sjanse for minst ett vanlig kort (ikke inform, honorable eller Icon) per pakke, og snittrating. Tallene
-- ved sjiktkantene (84+, 86+, 88+, 90+) avhenger ikke av hvor mange kort katalogen har per rating. Snittet gjør det,
-- så det er regnet ut med en antatt fordeling, og simulatoren traff Sjeldne spillere i 0100 (82,8 mot 82,9).
--                         snitt   84+      86+      88+      90+      Icon     inform
--   Stjerneutvalg (500)   84,3    100 %    100 %    47,3 %   6,6 %    -        21,5 %
--   Formpakka (750)       85,8    100 %    100 %    48,6 %   14,2 %   -        9,4 %   (pluss ett garantert spesialkort)
--   Skadoosh dude (1500)  85,7    100 %    100 %    100 %    44,6 %   3,0 %    67,2 %
--   Kachow pal (3500)     87,8    100 %    100 %    100 %    100 %    8,7 %    31,7 %  (pluss ett garantert Inner Peace-kort)
-- Hurtigsalg gir 25 % av kortets verdi (30 % for inform). Med den antatte fordelingen gir Stjerneutvalg og Formpakka
-- ca. 50–65 % av prisen tilbake hvis man selger alt, Skadoosh dude ca. 70 % (mot ca. 105 % ved 1000 MB, der man kunne
-- tjene på å åpne og selge) og Kachow pal ca. 38 %, med Inner Peace-kortet. Det siste er med vilje en dyr pakke for de som har mye MB.
-- Inner Peace-kortet gir ca. 325 MB ved hurtigsalg i snitt (vektet etter rating, se 0116).

-- 1) Skadoosh dude koster 1500 MB, og pakkene sorteres etter pris i butikken.
update manager_packs set price = 1500, sort_order = 8 where key = 'skadoosh_dude';

-- 2) De tre nye pakkene. Formpakka og Kachow pal har ett garantert spesialkort (special_guarantee), som kommer i tillegg
-- til de andre kortene og telles med i card_count. Formpakka trekker inform eller honorable mention (scope 'mix', se 0114),
-- og Kachow pal et Inner Peace-kort (scope 'inner_peace', se 0116).
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
  ('kachow_pal', 'Kachow pal', 'Ni kort: ett Inner Peace-kort (88–95) og åtte kort på 86+, garantert ett på 90+ og to på 88+, og ca. 9 % sjanse for en Icon. Maks 1 per dag.', 3500, 9, 88, 3,
    '[{"min":90,"count":1},{"min":88,"count":2}]',
    '[{"min":86,"max":86,"weight":34},{"min":87,"max":87,"weight":27},{"min":88,"max":88,"weight":17},{"min":89,"max":89,"weight":11},{"min":90,"max":90,"weight":6},{"min":91,"max":91,"weight":3},{"min":92,"max":99,"weight":2}]',
    '#a78bfa', 9, 0.05, 0, 0.0112, 0.04, 1, 'inner_peace', true, null, 1, false, null, null, null)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price = excluded.price, card_count = excluded.card_count,
  guarantee_min = excluded.guarantee_min, guarantee_count = excluded.guarantee_count, guarantees = excluded.guarantees, odds = excluded.odds,
  accent = excluded.accent, sort_order = excluded.sort_order, inform_chance = excluded.inform_chance, tots_chance = excluded.tots_chance,
  icon_chance = excluded.icon_chance, honorable_chance = excluded.honorable_chance, special_guarantee = excluded.special_guarantee,
  special_scope = excluded.special_scope, purchasable = excluded.purchasable, weekly_limit = excluded.weekly_limit,
  daily_purchase_limit = excluded.daily_purchase_limit, untradable = excluded.untradable, daily_limit = excluded.daily_limit,
  available_from = excluded.available_from, available_until = excluded.available_until, active = true;
