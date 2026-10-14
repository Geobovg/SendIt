-- Managerkampgrensen på 40 teller nå per kalenderdag (nullstilles ved midnatt, norsk tid) i stedet for per rullerende døgn.
-- Timegrensen for direkte venneutfordringer (5 per rullerende time) er uendret.
create or replace function public.enforce_manager_match_limits()
returns trigger language plpgsql set search_path=public,pg_temp
as $fn$
declare
  participant uuid;
  day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Oslo') at time zone 'Europe/Oslo';
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
      and started_at >= day_start) >= 40 then
      raise exception 'En spiller har nådd grensen på % managerkamper per dag',40;
    end if;
    if new.challenge_id is not null and (select count(*) from career_matches
      where mode='manager' and challenge_id is not null and id<>new.id
      and (home_user_id=participant or away_user_id=participant)
      and started_at >= now()-interval '1 hour') >= 5 then
      raise exception 'Maks % direkte managerkamper per time',5;
    end if;
  end loop;
  return new;
end;
$fn$;
