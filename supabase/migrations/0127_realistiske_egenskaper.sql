-- Realistiske egenskaper (pace, shooting, passing, dribbling, defending, physical), inspirert av FC.
-- Før var egenskapene rating + et fast tillegg per posisjon (0012), og spesialkortene la boosten på alle seks (0060 m.fl.). Det ga
-- angripere som lå over ratingen på nesten alt: Messi på 89 hadde 99 i skudd, pasning og dribling, og de beste Inner Peace-kortene
-- hadde over 480 i sum uten forsvar, mens Pelé (97) og Zidane (96) lå langt nede på listen.
-- I FC er rating et vektet snitt av egenskapene etter posisjon: en spiller er sterk på det posisjonen krever og svak på resten, og bare
-- de beste er mer enn ca. 5 over ratingen på én egenskap. Her regnes derfor alle egenskaper om slik:
--   ny = rating + nytt posisjonstillegg + avvik, der avviket er det spilleren hadde fra det gamle posisjonstillegget (FotMob-justeringen
--   fra 0121 og håndsatte verdier), holdt mellom -8 og +3, og ingen egenskap er mer enn 6 over ratingen eller under 20 eller over 99.
-- Nye posisjonstillegg (pace, shooting, passing, dribbling, defending, physical):
--   ST -7 / 2 / -11 / -5 / -45 / -6, RW og LW 3 / -2 / -6 / 3 / -45 / -15, CAM -10 / -4 / 1 / 1 / -30 / -18,
--   CM -10 / -10 / 0 / -2 / -15 / -12, CDM -16 / -14 / -4 / -8 / -3 / -4, CB -14 / -38 / -20 / -18 / 2 / -3,
--   RB og LB 0 / -22 / -8 / -5 / -8 / -10.
-- Resultat: en 89 på ving får ca. 84 / 90 / 86 / 94 / 43 / 74 (Messi) i stedet for 88 / 99 / 99 / 99 / 63 / 84, og summen uten forsvar
-- for en 90 på topp går fra ca. 460 til ca. 425. Spesialkort (inform, TOTS, honorable mention, Inner Peace) regnes med sin egen rating,
-- så de beholder forskjellen til vanlig-kortet, men får samme realistiske fordeling.
-- Ikke rørt: keepere (egenskapene er allerede lavere enn ratingen), ikoner (har ekte FC-verdier: Pelé 95/96/93/96/60/76, Zidane
-- 82/90/96/96/73/87) og personlige kort. Rating, pris og pakkesjanser er uendret, og kampmotoren bruker bare rating, så ingen kamper endres.
-- Eide kort får de nye verdiene (spesialkort fra sitt spesialkort, vanlige kort fra katalogen).

create or replace function public.stat_offset(pos text, stat text, new_scale boolean)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case when new_scale then
    case stat
      when 'pace' then case when pos = 'ST' then -7 when pos in ('RW','LW') then 3 when pos in ('RB','LB') then 0 when pos = 'CB' then -14 when pos = 'CDM' then -16 else -10 end
      when 'shooting' then case when pos = 'ST' then 2 when pos in ('RW','LW') then -2 when pos = 'CAM' then -4 when pos in ('RB','LB') then -22 when pos = 'CB' then -38 when pos = 'CDM' then -14 else -10 end
      when 'passing' then case when pos = 'ST' then -11 when pos in ('RW','LW') then -6 when pos = 'CAM' then 1 when pos in ('RB','LB') then -8 when pos = 'CB' then -20 when pos = 'CDM' then -4 else 0 end
      when 'dribbling' then case when pos = 'ST' then -5 when pos in ('RW','LW') then 3 when pos = 'CAM' then 1 when pos in ('RB','LB') then -5 when pos = 'CB' then -18 when pos = 'CDM' then -8 else -2 end
      when 'defending' then case when pos = 'ST' then -45 when pos in ('RW','LW') then -45 when pos = 'CAM' then -30 when pos in ('RB','LB') then -8 when pos = 'CB' then 2 when pos = 'CDM' then -3 else -15 end
      else case when pos = 'ST' then -6 when pos in ('RW','LW') then -15 when pos = 'CAM' then -18 when pos in ('RB','LB') then -10 when pos = 'CB' then -3 when pos = 'CDM' then -4 else -12 end
    end
  else
    case stat
      when 'pace' then case when pos = 'RW' or pos = 'LW' then 7 when pos = 'ST' then 4 when pos in ('RB','LB') then 3 else -1 end
      when 'shooting' then case when pos = 'ST' then 6 when pos in ('RW','LW','CAM') then 3 when pos in ('CB','RB','LB') then -18 when pos = 'CDM' then -9 else -2 end
      when 'passing' then case when pos in ('CM','CAM','CDM') then 4 when pos in ('CB','RB','LB') then -6 when pos = 'ST' then -9 else 0 end
      when 'dribbling' then case when pos in ('RW','LW','CAM') then 5 when pos = 'ST' then 1 when pos in ('CB','RB','LB') then -8 else 0 end
      when 'defending' then case when pos = 'CB' then 6 when pos in ('RB','LB') then 3 when pos = 'CDM' then 4 when pos in ('RW','LW','ST') then -25 when pos = 'CAM' then -17 else -8 end
      else case when pos in ('CB','ST') then 3 when pos = 'CDM' then 2 when pos in ('RW','LW') then -5 else -1 end
    end
  end;
$fn$;

create or replace function public.realistic_attributes(pos text, rating integer, old_attributes jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select old_attributes || coalesce(jsonb_object_agg(stat.key,
    greatest(20, least(99, rating + 6, rating + public.stat_offset(pos, stat.key, true)
      + greatest(-8, least(3, coalesce((old_attributes->>stat.key)::integer, rating + public.stat_offset(pos, stat.key, false)) - rating - public.stat_offset(pos, stat.key, false)))))
  ), '{}'::jsonb)
  from (values ('pace'), ('shooting'), ('passing'), ('dribbling'), ('defending'), ('physical')) as stat (key);
$fn$;

revoke all on function public.stat_offset(text, text, boolean) from public, anon, authenticated;
revoke all on function public.realistic_attributes(text, integer, jsonb) from public, anon, authenticated;

-- 1) Katalogen (ikoner og keepere røres ikke).
update player_catalog
set attributes = public.realistic_attributes(position, overall, attributes)
where position <> 'GK' and coalesce(league, '') <> 'icons';

-- 2) Spesialkortene, regnet fra sin egen rating og de gamle egenskapene på kortet.
update special_cards card
set attributes = public.realistic_attributes(catalog.position, card.overall, card.attributes)
from player_catalog catalog
where catalog.id = card.catalog_id
  and card.kind <> 'icon'
  and catalog.position <> 'GK'
  and coalesce(catalog.league, '') <> 'icons';

-- 3) Eide kort: spesialkort får egenskapene fra spesialkortet, vanlige kort fra katalogen. Personlige kort (uten katalog) røres ikke.
update manager_cards owned
set attributes = card.attributes
from special_cards card
where owned.special_card_id = card.id
  and card.kind <> 'icon'
  and owned.catalog_id is not null
  and owned.position <> 'GK';

update manager_cards owned
set attributes = catalog.attributes
from player_catalog catalog
where owned.catalog_id = catalog.id
  and owned.special_card_id is null
  and catalog.position <> 'GK'
  and coalesce(catalog.league, '') <> 'icons';
