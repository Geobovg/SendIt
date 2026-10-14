-- Sjeldne spillere (200 MB) og Jumbo premium gull (300 MB) gir mye bedre kort enn i 0099. Sjansen for 86+ og høyere
-- er flere ganger høyere, og informs og honorable mentions kommer oftere. Garantier, priser og antall kort er
-- uendret. De tre billigste pakkene er ikke rørt. Simulert sjanse for minst ett kort per pakke, og snittrating:
--                        snitt   84+      86+      88+      90+
--   Sjeldne spillere     82,9    87,9 %   46,0 %   14,2 %   2,9 %   (før 82,2 / 64,7 / 22,9 / 5,5 / ca. 1)
--   Jumbo premium gull   81,8    95,8 %   67,7 %   26,4 %   5,9 %   (før 81,1 / 85,3 / 44,6 / 14,2 / ca. 2,5)

update manager_packs set
  odds = '[{"min":80,"max":82,"weight":45},{"min":83,"max":83,"weight":22},{"min":84,"max":85,"weight":22},{"min":86,"max":87,"weight":8.5},{"min":88,"max":89,"weight":2.4},{"min":90,"max":99,"weight":0.6}]',
  inform_chance = 0.035, honorable_chance = 0.007
where key = 'sjeldne_spillere';

update manager_packs set
  odds = '[{"min":79,"max":79,"weight":28},{"min":80,"max":82,"weight":34},{"min":83,"max":83,"weight":16},{"min":84,"max":85,"weight":14},{"min":86,"max":87,"weight":6.5},{"min":88,"max":89,"weight":2},{"min":90,"max":99,"weight":0.5}]',
  inform_chance = 0.025, honorable_chance = 0.005
where key = 'jumbo_premium_gull';
