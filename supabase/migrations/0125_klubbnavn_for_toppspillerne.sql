-- De 15 mest aktive managerne får et eget klubbnavn i stedet for standardnavnet «My team».
-- Navnene er laget ut fra statistikken deres per 19. oktober 2026.
-- Har noen allerede byttet navn selv, røres det ikke.
update player_profiles pp
set club_name = v.club_name, updated_at = now()
from (values
  ('f_edits', 'Casp Farming AS'),            -- 5 068 kamper mot Casp, 13 343 pakker
  ('Casp', 'Treningsdukken IL'),             -- 130 seire på 4 897 kamper, nesten alle mot f_edits
  ('Wraulswuarne', 'Ærlig Grind BK'),        -- flest kamper og sesonger uten farming
  ('Bjarne', 'Nesten Mester FK'),            -- Camp Nou divisjon 1, ett steg fra mestertittelen
  ('Per', '193 Pakker Om Dagen'),            -- 3 473 pakker på 18 dager
  ('Loud8', 'Draftkongen IF'),               -- 49 drafts og 6 drafttitler
  ('Chriseek', 'Chris Seeking Glory'),       -- fortsatt på jakt, Ullevaal divisjon 4
  ('Big_cal', 'Big Calorie United'),         -- Ullevaal divisjon 2
  ('Simen', 'Jojo FK'),                      -- 66 sesonger, bare 30 opprykk
  ('Geo', 'Blakke Grunnleggere FC'),         -- første bruker, flest aktive dager, 24 MB igjen
  ('Rogbert', 'Wembley Neste Stopp'),        -- Wembley divisjon 1
  ('Howie', 'Howie Taper Ikke'),             -- 71 % seire, best av alle uten farming
  ('Mjau', 'Katten Som Forsvant'),           -- 600 kamper på fem dager, borte siden 8. oktober
  ('Gryteknuten', 'Gryta Koker Sakte'),      -- jevn og rolig, Ullevaal divisjon 4
  ('Vicco', 'Pakker Før Poeng FK')           -- 531 pakker, men bare 13 sesonger
) as v(username, club_name)
join profiles p on p.username = v.username
where pp.user_id = p.id
  and pp.club_name in ('My team', 'Mitt lag');
