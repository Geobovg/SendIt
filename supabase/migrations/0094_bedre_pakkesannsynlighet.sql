-- Bedre sannsynlighet i pakkene, så de dyre pakkene gir tydelig bedre kort enn de billige.
-- Før lå Jumbo premium gull (300 MB) på samme nivå som Sjeldne spillere (200 MB), og Gullpakke, Gull spillerpakke og
-- Premium gull var nesten like. Nå øker sjansen for gode kort jevnt med prisen. Garantier, priser og antall kort er
-- uendret, bare vektene per ratingsjikt (se 0034) er endret. Simulert sjanse for minst ett kort per pakke:
--                        84+      86+     88+
--   Gullpakke (40)       3,4 %    0,5 %   0,1 %   (før 2,1 / 0,2 / 0,0)
--   Gull spillerpakke    7,4 %    1,2 %   0,2 %   (før 4,6 / 0,7 / 0,1)
--   Premium gull (100)   18,8 %   3,7 %   0,7 %   (før 8,8 / 1,4 / 0,3)
--   Sjeldne spillere     49,7 %   11,3 %  2,4 %   (før 26,7 / 4,3 / 0,8)
--   Jumbo premium gull   74,5 %   23,4 %  5,9 %   (før 23,4 / 4,1 / 0,8)

update manager_packs set odds =
  '[{"min":40,"max":74,"weight":50},{"min":75,"max":79,"weight":41},{"min":80,"max":82,"weight":7.4},{"min":83,"max":83,"weight":0.8},{"min":84,"max":85,"weight":0.9},{"min":86,"max":87,"weight":0.12},{"min":88,"max":89,"weight":0.025},{"min":90,"max":99,"weight":0.004}]'
where key = 'gullpakke';

update manager_packs set odds =
  '[{"min":40,"max":74,"weight":42},{"min":75,"max":79,"weight":45},{"min":80,"max":82,"weight":10.5},{"min":83,"max":83,"weight":1.2},{"min":84,"max":85,"weight":1.1},{"min":86,"max":87,"weight":0.17},{"min":88,"max":89,"weight":0.035},{"min":90,"max":99,"weight":0.006}]'
where key = 'gull_spillere';

update manager_packs set odds =
  '[{"min":40,"max":74,"weight":34},{"min":75,"max":79,"weight":48},{"min":80,"max":82,"weight":14.5},{"min":83,"max":83,"weight":1.9},{"min":84,"max":85,"weight":1.4},{"min":86,"max":87,"weight":0.26},{"min":88,"max":89,"weight":0.055},{"min":90,"max":99,"weight":0.01}]'
where key = 'premium_gull';

update manager_packs set odds =
  '[{"min":80,"max":82,"weight":74},{"min":83,"max":83,"weight":16},{"min":84,"max":85,"weight":8},{"min":86,"max":87,"weight":1.6},{"min":88,"max":89,"weight":0.35},{"min":90,"max":99,"weight":0.07}]'
where key = 'sjeldne_spillere';

update manager_packs set odds =
  '[{"min":79,"max":79,"weight":52},{"min":80,"max":82,"weight":30},{"min":83,"max":83,"weight":9.5},{"min":84,"max":85,"weight":7.5},{"min":86,"max":87,"weight":1.6},{"min":88,"max":89,"weight":0.4},{"min":90,"max":99,"weight":0.09}]'
where key = 'jumbo_premium_gull';
