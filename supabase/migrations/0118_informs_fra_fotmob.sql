-- Informs etter ekte form fra FotMob. Fantasy-dataene fra API-Football (football_fixture_players) er fjernet, så de siste rundene
-- har vært tilfeldige (0086 faller tilbake på det når det ikke finnes kampdata).
-- * Ny tabell fotmob_form med én rad per spiller og kamp: kampkarakter, minutter, mål og målgivende fra FotMob.
--   Den fylles av scripts/fotmob/synk-form.mjs (GitHub Actions-jobben «FotMob-form», fredag før kl. 18:00 norsk tid),
--   og bare serveren (service role) kan lese og skrive den.
-- * ensure_special_round (fra 0086) leser nå fotmob_form i stedet for football_fixture_players. Alt annet er som før:
--   startellever (1 keeper, 4 forsvarere, 3 midtbane, 3 angrep) + de 12 beste av resten, boost +3 fra 9,0, +2 fra 8,0, ellers +1,
--   og tilfeldig fylling blant topp 400 hvis det mangler data.

create table if not exists fotmob_form (
  slug text not null references player_catalog (slug) on delete cascade,
  match_id text not null,
  kickoff_at timestamptz not null,
  minutes integer not null check (minutes >= 0),
  rating numeric(3, 1) check (rating between 1 and 10),
  goals integer not null default 0,
  assists integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (slug, match_id)
);

create index if not exists fotmob_form_kickoff_idx on fotmob_form (kickoff_at);

-- Ingen policyer: bare service role (serveren) kan lese og skrive.
alter table fotmob_form enable row level security;

create or replace function public.ensure_special_round()
returns uuid
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  bounds jsonb := public.sbc_week_bounds();
  week_start timestamptz := (bounds->>'week_start')::timestamptz;
  new_round uuid;
  round_size integer := public.game_setting_int('inform_round_size', 23);
  pool_size integer := public.game_setting_int('inform_pool_size', 400);
  cooldown integer := public.game_setting_int('inform_cooldown_rounds', 2);
  max_overall integer := public.game_setting_int('inform_max_overall', 90);
  pick record;
  missing integer;
begin
  select id into new_round from special_rounds where kind = 'inform' and starts_at = week_start;
  if new_round is not null then return new_round; end if;
  -- To samtidige forespørsler skal ikke lage to runder.
  perform pg_advisory_xact_lock(hashtext('special_rounds:inform'));
  select id into new_round from special_rounds where kind = 'inform' and starts_at = week_start;
  if new_round is not null then return new_round; end if;

  insert into special_rounds (kind, starts_at, ends_at) values ('inform', week_start, (bounds->>'next_reset')::timestamptz)
  returning id into new_round;

  -- Ekte form: beste kampkarakter fra FotMob siste uke (minst 45 minutter), litt ekstra for mål og målgivende.
  for pick in
    with form as (
      select catalog.id as catalog_id,
        max(stats.rating) + 0.3 * sum(stats.goals) + 0.2 * sum(stats.assists) as score
      from fotmob_form stats
      join player_catalog catalog on catalog.slug = stats.slug
      where stats.kickoff_at >= week_start - interval '7 days' and stats.kickoff_at < week_start
        and stats.minutes >= 45 and stats.rating is not null
      group by catalog.id
    ),
    candidates as (
      select form.catalog_id, form.score, base.from_overall, base.from_attributes,
        case when catalog.position = 'GK' then 'GK'
          when catalog.position in ('RB', 'CB', 'LB') then 'DEF'
          when catalog.position in ('CDM', 'CM', 'CAM') then 'MID'
          else 'FWD' end as line
      from form
      join player_catalog catalog on catalog.id = form.catalog_id and catalog.active
      cross join lateral public.inform_base(catalog.id) base
      where base.from_overall < max_overall
    ),
    ranked as (
      select candidates.*, row_number() over (partition by line order by score desc, catalog_id) as line_rank from candidates
    )
    select ranked.* from ranked
    order by (line = 'GK' and line_rank <= 1) or (line = 'DEF' and line_rank <= 4) or (line = 'MID' and line_rank <= 3) or (line = 'FWD' and line_rank <= 3) desc,
      score desc, catalog_id
    limit round_size
  loop
    perform public.insert_inform_card(new_round, pick.catalog_id, pick.from_overall, pick.from_attributes,
      case when pick.score >= 9 then 3 when pick.score >= 8 then 2 else 1 end);
  end loop;

  -- Mangler det kort, trekkes resten tilfeldig blant topp 400 som før (ikke spillere fra de siste rundene).
  missing := round_size - (select count(*) from special_cards where special_cards.round_id = new_round);
  if missing > 0 then
    for pick in
      with ranked as (
        select catalog.id, row_number() over (order by catalog.overall desc, catalog.price desc, catalog.id) as rank
        from player_catalog catalog where catalog.active
      )
      select ranked.id, base.from_overall, base.from_attributes, random() as roll
      from ranked cross join lateral public.inform_base(ranked.id) base
      where ranked.rank <= pool_size and base.from_overall < max_overall
        and ranked.id not in (select card.catalog_id from special_cards card where card.round_id = new_round)
        and ranked.id not in (
          select card.catalog_id from special_cards card
          where card.round_id in (select id from special_rounds where kind = 'inform' and starts_at < week_start order by starts_at desc limit cooldown)
        )
      order by random()
      limit missing
    loop
      perform public.insert_inform_card(new_round, pick.id, pick.from_overall, pick.from_attributes,
        case when pick.roll < 0.6 then 1 when pick.roll < 0.9 then 2 else 3 end);
    end loop;
  end if;

  return new_round;
end;
$fn$;
