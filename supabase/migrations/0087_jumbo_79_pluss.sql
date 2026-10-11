-- Jumbo premium gull: alle tolv kortene er 79 eller bedre. Sjiktene under 79 fjernes, og vekten deres går til 79,
-- så sjansen for 80+ per kort er den samme som før. Garantiene (tre på 80+ og ett på 83+) er uendret.
update manager_packs set
  description = 'Tolv kort, alle 79+, garantert tre på 80+ og ett på 83+. Maks 3 per dag.',
  odds = '[{"min":79,"max":79,"weight":86},{"min":80,"max":82,"weight":11},{"min":83,"max":83,"weight":1.2},{"min":84,"max":85,"weight":0.25},{"min":86,"max":87,"weight":0.04},{"min":88,"max":89,"weight":0.008},{"min":90,"max":99,"weight":0.0015}]'
where key = 'jumbo_premium_gull';
