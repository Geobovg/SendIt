-- Bjarne heter «Head & Shoulders bro» i stedet for «Nesten Mester FK» fra 0125.
-- Har han byttet navn selv i mellomtiden, røres det ikke.
update player_profiles pp
set club_name = 'Head & Shoulders bro', updated_at = now()
from profiles p
where pp.user_id = p.id
  and p.username = 'Bjarne'
  and pp.club_name in ('Nesten Mester FK', 'My team', 'Mitt lag');
