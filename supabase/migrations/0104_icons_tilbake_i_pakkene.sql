-- Icons (de 20 legendene fra 0074) kan igjen trekkes i de kjøpbare pakkene, men skal være veldig sjeldne, slik som
-- i FC. Siden 0082 har icon_chance stått på 0 i alle pakker, så ingen har fått en Icon.
-- Sjansen gjelder hvert kort som ikke er garantert (arenaen løfter den litt), og en Icon trekkes jevnt blant de 20.
-- Det er langt under inform og honorable mention (som ligger på 1–7 % per kort). Omtrentlig sjanse for minst én
-- Icon per pakke:
--   Gullpakke            0,03 %   (3 kort,  0,01 % per kort)
--   Gull spillerpakke    0,10 %   (5 kort,  0,02 % per kort)
--   Premium gull         0,18 %   (6 kort,  0,03 % per kort)
--   Sjeldne spillere     0,30 %   (5 kort,  0,06 % per kort)
--   Jumbo premium gull   0,72 %   (12 kort, 0,06 % per kort)
-- Draftpakkene og spesialpakken er uendret.

update manager_packs set icon_chance = 0.0001 where key = 'gullpakke';
update manager_packs set icon_chance = 0.0002 where key = 'gull_spillere';
update manager_packs set icon_chance = 0.0003 where key = 'premium_gull';
update manager_packs set icon_chance = 0.0006 where key = 'sjeldne_spillere';
update manager_packs set icon_chance = 0.0006 where key = 'jumbo_premium_gull';
