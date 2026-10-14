-- Draft koster 150 MB å være med på, ikke 50. Samme beløp betales tilbake hvis draften avlyses,
-- så vi endrer bare innsatsen. Holdes lik DRAFT_ENTRY_FEE i src/lib/draft-core.ts.
create or replace function public.draft_entry_fee()
returns integer language sql immutable set search_path = public, pg_temp
as $fn$ select 150 $fn$;
