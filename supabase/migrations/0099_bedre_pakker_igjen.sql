-- Merkbart bedre kort i butikkpakkene, uten at de blir ødelagte. Sjansene for 80+ og 83+ øker litt, og sjansene for
-- de store kortene (86+, 88+ og 90+) er omtrent doblet. Sjansen for informs og honorable mentions er 50 % høyere.
-- Garantier, priser og antall kort er uendret (så beskrivelsene og oversettelsene stemmer fortsatt), bare vektene per
-- ratingsjikt (se 0034 og 0094) er endret. Simulert sjanse for minst ett kort per pakke, og snittrating per kort:
--                        snitt   80+      83+      84+      86+      88+
--   Gullpakke (40)       69,6    36,7 %   9,6 %    5,7 %    1,2 %    0,2 %   (før 68,7 / 27,7 / 5,9 / 3,4 / 0,5 / 0,1)
--   Gull spillerpakke    71,3    64,6 %   19,3 %   10,5 %   2,7 %    0,6 %   (før 70,2 / 53,6 / 12,6 / 6,6 / 1,1 / 0,2)
--   Premium gull (100)   76,1    100 %    47,8 %   27,5 %   7,9 %    1,8 %   (før 75,4 / 100 / 37,1 / 18,8 / 3,7 / 0,8)
--   Sjeldne spillere     82,2    100 %    100 %    64,7 %   22,9 %   5,5 %   (før 81,9 / 100 / 100 / 49,8 / 11,6 / 2,5)
--   Jumbo premium gull   81,1    100 %    100 %    85,3 %   44,6 %   14,2 %  (før 80,6 / 100 / 100 / 74,7 / 23,4 / 6,1)

update manager_packs set
  odds = '[{"min":40,"max":74,"weight":44},{"min":75,"max":79,"weight":42},{"min":80,"max":82,"weight":10},{"min":83,"max":83,"weight":1.3},{"min":84,"max":85,"weight":1.4},{"min":86,"max":87,"weight":0.3},{"min":88,"max":89,"weight":0.065},{"min":90,"max":99,"weight":0.012}]',
  inform_chance = 0.0015, honorable_chance = 0.0003
where key = 'gullpakke';

update manager_packs set
  odds = '[{"min":40,"max":74,"weight":36},{"min":75,"max":79,"weight":47},{"min":80,"max":82,"weight":13.5},{"min":83,"max":83,"weight":1.9},{"min":84,"max":85,"weight":1.6},{"min":86,"max":87,"weight":0.42},{"min":88,"max":89,"weight":0.095},{"min":90,"max":99,"weight":0.017}]',
  inform_chance = 0.003, honorable_chance = 0.0006
where key = 'gull_spillere';

update manager_packs set
  odds = '[{"min":40,"max":74,"weight":24},{"min":75,"max":79,"weight":50},{"min":80,"max":82,"weight":21},{"min":83,"max":83,"weight":3.4},{"min":84,"max":85,"weight":2.7},{"min":86,"max":87,"weight":0.8},{"min":88,"max":89,"weight":0.19},{"min":90,"max":99,"weight":0.034}]',
  inform_chance = 0.006, honorable_chance = 0.0012
where key = 'premium_gull';

update manager_packs set
  odds = '[{"min":80,"max":82,"weight":66},{"min":83,"max":83,"weight":19},{"min":84,"max":85,"weight":12},{"min":86,"max":87,"weight":3.7},{"min":88,"max":89,"weight":0.9},{"min":90,"max":99,"weight":0.18}]',
  inform_chance = 0.015, honorable_chance = 0.003
where key = 'sjeldne_spillere';

update manager_packs set
  odds = '[{"min":79,"max":79,"weight":42},{"min":80,"max":82,"weight":34},{"min":83,"max":83,"weight":12},{"min":84,"max":85,"weight":9.5},{"min":86,"max":87,"weight":3.6},{"min":88,"max":89,"weight":1.05},{"min":90,"max":99,"weight":0.23}]',
  inform_chance = 0.009, honorable_chance = 0.0018
where key = 'jumbo_premium_gull';
