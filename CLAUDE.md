@AGENTS.md

# Databasemigreringer

Migreringene i `supabase/migrations` kjøres automatisk mot produksjonsdatabasen når de merges til `main`
(`.github/workflows/supabase-migrations.yml`). Ikke be brukeren kjøre SQL i Supabase selv.

- Nye migreringer får neste ledige nummer (`0085_beskrivelse.sql` osv.). Nummeret må være unikt.
- Endre aldri en migrering som allerede er på `main`; lag en ny i stedet. Den gamle kjøres ikke på nytt.
- En migrering kjøres bare én gang, så den må virke mot databasen slik den er nå.
- Feiler en migrering, blir jobben rød i GitHub Actions og ingenting av den migreringen blir lagret.

# Nye korttyper og pakker

Hver ny korttype (inform, honorable mention, Icon, Inner Peace osv.) må kunne trekkes i pakkene. Legg derfor alltid en sjanse i
pakkene i samme migrering som kortene lages, ellers blir de bare synlige i galleriet.

- Sjansen settes per pakke, etter pris, og er sjeldnere jo bedre kortene er. Se `manager_packs` (`inform_chance`,
  `honorable_chance`, `icon_chance`, `inner_peace_chance`) og `deliver_manager_pack` for mekanikken.
- Nye kolonner for sjanser må med i `ManagerPack` og `packColumns` i `src/lib/career.ts`, i `PackOdds` i
  `src/components/pack-store.tsx` og i `src/i18n/*/market.ts` (alle språk).
- Oppdater `CONTEXT.md` (korttypen og **Pakke**) og skriv tallene i migreringskommentaren.
