-- Skadoosh dude (1000 MB) kan kjøpes én gang per dag (norsk tid, nullstilles ved midnatt som de andre dagsgrensene).
update manager_packs set
  daily_purchase_limit = 1,
  description = 'Femten kort, alle 80+, garantert ett på 88+, to på 86+ og fire på 84+. Maks 1 per dag.'
where key = 'skadoosh_dude';
