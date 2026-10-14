-- Merkbart bedre kort i butikkpakkene, uten at de blir ødelagte. Sjansene for 80+ og spesielt 83+ øker, og sjansen
-- for informs og honorable mentions er 50 % høyere. Garantier, priser og antall kort er uendret (så beskrivelsene
-- og oversettelsene stemmer fortsatt), bare vektene per ratingsjikt (se 0034 og 0094) er endret. Simulert sjanse for
-- minst ett kort per pakke, og snittrating per kort:
--                        snitt   80+      83+      84+      86+     88+
--   Gullpakke (40)       69,6    36,2 %   9,1 %    5,1 %    0,8 %   0,2 %   (før 68,6 / 27,3 / 5,9 / 3,4 / 0,5 / 0,1)
--   Gull spillerpakke    71,2    64,3 %   18,3 %   9,6 %    1,8 %   0,4 %   (før 70,1 / 54,0 / 12,6 / 6,7 / 1,0 / 0,2)
--   Premium gull (100)   76,1    100 %    46,5 %   25,6 %   5,4 %   1,1 %   (før 75,4 / 100 / 37,2 / 18,9 / 3,7 / 0,8)
--   Sjeldne spillere     82,1    100 %    100 %    61,6 %   16,2 %  3,5 %   (før 81,9 / 100 / 100 / 49,7 / 11,5 / 2,4)
--   Jumbo premium gull   81,0    100 %    100 %    82,0 %   32,7 %  9,1 %   (før 80,6 / 100 / 100 / 74,7 / 23,4 / 6,0)

update manager_packs set
  odds = '[{"min":40,"max":74,"weight":44},{"min":75,"max":79,"weight":42},{"min":80,"max":82,"weight":10},{"min":83,"max":83,"weight":1.3},{"min":84,"max":85,"weight":1.4},{"min":86,"max":87,"weight":0.2},{"min":88,"max":89,"weight":0.04},{"min":90,"max":99,"weight":0.007}]',
  inform_chance = 0.0015, honorable_chance = 0.0003
where key = 'gullpakke';

update manager_packs set
  odds = '[{"min":40,"max":74,"weight":36},{"min":75,"max":79,"weight":47},{"min":80,"max":82,"weight":13.5},{"min":83,"max":83,"weight":1.9},{"min":84,"max":85,"weight":1.6},{"min":86,"max":87,"weight":0.28},{"min":88,"max":89,"weight":0.06},{"min":90,"max":99,"weight":0.01}]',
  inform_chance = 0.003, honorable_chance = 0.0006
where key = 'gull_spillere';

update manager_packs set
  odds = '[{"min":40,"max":74,"weight":24},{"min":75,"max":79,"weight":50},{"min":80,"max":82,"weight":21},{"min":83,"max":83,"weight":3.4},{"min":84,"max":85,"weight":2.7},{"min":86,"max":87,"weight":0.55},{"min":88,"max":89,"weight":0.12},{"min":90,"max":99,"weight":0.02}]',
  inform_chance = 0.006, honorable_chance = 0.0012
where key = 'premium_gull';

update manager_packs set
  odds = '[{"min":80,"max":82,"weight":66},{"min":83,"max":83,"weight":19},{"min":84,"max":85,"weight":12},{"min":86,"max":87,"weight":2.5},{"min":88,"max":89,"weight":0.55},{"min":90,"max":99,"weight":0.11}]',
  inform_chance = 0.015, honorable_chance = 0.003
where key = 'sjeldne_spillere';

update manager_packs set
  odds = '[{"min":79,"max":79,"weight":42},{"min":80,"max":82,"weight":34},{"min":83,"max":83,"weight":12},{"min":84,"max":85,"weight":9.5},{"min":86,"max":87,"weight":2.4},{"min":88,"max":89,"weight":0.65},{"min":90,"max":99,"weight":0.14}]',
  inform_chance = 0.009, honorable_chance = 0.0018
where key = 'jumbo_premium_gull';
