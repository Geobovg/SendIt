-- Brødrestevnet brooor (0114) delte ut pakken når manageren åpnet en managerside, med et databasekall på hver
-- sidelasting. Det er fjernet fra sidene. I stedet får alle som har en managerprofil pakken her, én gang. De som
-- allerede har fått den (event_gift_claims), får ingen ny. Pakken ligger i butikken og åpnes når manageren vil.
with new_claims as (
  insert into event_gift_claims (user_id, gift_key)
  select profile.user_id, gift.key
  from player_profiles profile
  cross join event_gifts gift
  where gift.key = 'brodrestevnet_brooor'
  on conflict do nothing
  returning user_id, gift_key
)
insert into manager_pack_inventory (user_id, pack_key, quantity)
select claim.user_id, gift.pack_key, 1
from new_claims claim
join event_gifts gift on gift.key = claim.gift_key
on conflict (user_id, pack_key) do update set quantity = manager_pack_inventory.quantity + 1, updated_at = now();
