-- Jumbo premium gull (300 MB) har åtte kort i stedet for tolv. Prisen, garantiene (tre på 80+ og ett på 83+) og
-- sannsynlighetene per kort er uendret, så kortene er like gode hver for seg, men det blir færre av dem.
-- Simulert sjanse for minst ett kort i pakka (før med tolv kort → nå med åtte):
--   84+: 100 % → 100 %   86+: 99 % → 95 %   88+: 76 % → 62 %   90+: 30 % → 21 %
-- Sjeldne spillere (200 MB, fem kort) er fortsatt tydelig dårligere: 86+ 62 %, 88+ 26 %, 90+ 6 %.
-- Sjansen for inform og honorable gjelder hvert kort som ikke er garantert. Med åtte kort er fire garantert, så
-- fire kort kan bli spesialkort, og hvert av dem får høyere sjanse (8 / 4 i stedet for 12 / 8 av kortene).

update manager_packs set
  card_count = 8,
  description = 'Åtte kort, alle 79+, garantert tre på 80+ og ett på 83+. Maks 3 per dag.'
where key = 'jumbo_premium_gull';
