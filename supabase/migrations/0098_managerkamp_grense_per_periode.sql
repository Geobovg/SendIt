-- Managerkampgrensen på 40 teller nå per fast 6-timersperiode etter norsk tid (00–06, 06–12, 12–18, 18–24)
-- i stedet for per rullerende døgn. Timegrensen for direkte venneutfordringer (5 per rullerende time) er uendret.
--
-- Nullstilling for alle: kamper startet før det siste tidspunktet i match_limit_resets teller ikke mot grensene.
-- Kampene og historikken blir liggende. Samme tabell leses av appen (src/lib/match-limit.ts), også for Femmer.
create table if not exists match_limit_resets (
  id bigint generated always as identity primary key,
  reset_at timestamptz not null default now()
);
alter table match_limit_resets enable row level security;
insert into match_limit_resets(reset_at) values (now());

create or replace function public.enforce_manager_match_limits()
returns trigger language plpgsql set search_path=public,pg_temp
as $fn$
declare
  participant uuid;
  local_now timestamp := now() at time zone 'Europe/Oslo';
  reset_at timestamptz := coalesce((select max(r.reset_at) from match_limit_resets r), '-infinity');
  -- Starten på inneværende periode: klokketimen rundet ned til nærmeste 6, regnet i norsk veggklokketid.
  period_start timestamptz := greatest(
    (date_trunc('day', local_now) + floor(extract(hour from local_now) / 6) * interval '6 hours') at time zone 'Europe/Oslo',
    reset_at);
  hour_start timestamptz := greatest(now() - interval '1 hour', reset_at);
begin
  if new.mode <> 'manager' or new.started_at is null then return new; end if;
  -- Bare første kampstart: oppgjør, bytter og fortsettelse av en startet kamp bruker ingen ny kvote.
  if tg_op='UPDATE' then
    if old.mode='manager' and old.started_at is not null then return new; end if;
  end if;

  -- Samme rekkefølge for hjemme/borte, så samtidige starter med felles deltaker blir serialisert.
  for participant in select distinct id from unnest(array[new.home_user_id,new.away_user_id]) as users(id)
    where id is not null order by id
  loop
    perform pg_advisory_xact_lock(hashtextextended('manager-match-limit:'||participant::text,0));
  end loop;
  for participant in select distinct id from unnest(array[new.home_user_id,new.away_user_id]) as users(id)
    where id is not null order by id
  loop
    if (select count(*) from career_matches where mode='manager' and id<>new.id
      and (home_user_id=participant or away_user_id=participant)
      and started_at >= period_start) >= 40 then
      raise exception 'En spiller har nådd grensen på % managerkamper per 6 timer',40;
    end if;
    if new.challenge_id is not null and (select count(*) from career_matches
      where mode='manager' and challenge_id is not null and id<>new.id
      and (home_user_id=participant or away_user_id=participant)
      and started_at >= hour_start) >= 5 then
      raise exception 'Maks % direkte managerkamper per time',5;
    end if;
  end loop;
  return new;
end;
$fn$;
