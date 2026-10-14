-- Jumbo premium gull (300 MB) er nå tydelig den beste pakka, også per kort, og Sjeldne spillere (200 MB) er bedre
-- enn i 0100. Før lå Sjeldne spillere over Jumbo i snittrating per kort, selv om Jumbo har tolv kort mot fem.
-- Garantier, priser og antall kort er uendret. Simulert snittrating per kort og sjanse for minst ett kort per pakke:
--                        snitt   86+      88+      90+
--   Sjeldne spillere     83,2    51,1 %   17,7 %   4,0 %   (før 82,9 / 46,0 / 14,2 / 2,9)
--   Jumbo premium gull   83,9    96,1 %   62,8 %   21,2 %  (før 81,8 / 67,7 / 26,4 / 5,9)

update manager_packs set
  odds = '[{"min":80,"max":82,"weight":38},{"min":83,"max":83,"weight":23},{"min":84,"max":85,"weight":26},{"min":86,"max":87,"weight":9.5},{"min":88,"max":89,"weight":3},{"min":90,"max":99,"weight":0.8}]',
  inform_chance = 0.04, honorable_chance = 0.008
where key = 'sjeldne_spillere';

update manager_packs set
  odds = '[{"min":79,"max":79,"weight":5},{"min":80,"max":82,"weight":22},{"min":83,"max":83,"weight":20},{"min":84,"max":85,"weight":30},{"min":86,"max":87,"weight":16},{"min":88,"max":89,"weight":6},{"min":90,"max":99,"weight":2}]',
  inform_chance = 0.04, honorable_chance = 0.008
where key = 'jumbo_premium_gull';
