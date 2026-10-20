# Univers: ny start etter Camp Nou

Etter at de første managerne vant divisjon 1 på Camp Nou, var det ingenting mer å vinne. I stedet for en ny nullstilling for alle (som i migrering 0081) sender vi den som vinner til et nytt **univers** med full ny start, mens de som ikke er der ennå, fortsetter som før.

Vi valgte å bytte ut dataene i stedet for å merke alle tabeller med univers. Nesten alle tabeller i managerkarrieren (kort, lag, annonser, sesonger, stadion) er knyttet til brukeren, så `universe_id` overalt ville vært en stor og risikabel endring. Ved flyttingen (`advance_universe`, migrering 0128) lagres derfor laget, kortene, statistikken og sesongene som ett frosset øyeblikksbilde (`universe_archives.snapshot`), og de levende radene nullstilles på samme måte som i 0081, bare for én bruker. Det gamle universet kan ses, men ikke spilles, siden det ikke finnes noen levende rader å spille med.

Det som er per univers i det levende spillet er `player_profiles.universe`: `pick_season_opponents` henter bare motstandere fra samme univers, og overgangsmarkedet (liste, bud og kjøp) er adskilt i serverkoden (`src/lib/universe.ts`, `src/lib/market-actions.ts`). Vennekamper og vennesesonger går på tvers. Arenaene har nye navn og farger i hvert annet univers (`arenasOf` i `src/lib/arenas.ts`), men tallene (rating, bonus, premiefaktor) er de samme, så vanskeligheten er uendret.

Klubbnivå og XP, venner, profil, Femmer, turneringer og det personlige kortet beholdes, siden de er kontoens, ikke karrierens. Det personlige kortet settes tilbake til 70 som ved 0081. MB og stadion starter på nytt (120 MB, stadion på nivå 1).

Overgangsanimasjonen vises når `universe_archives.seen_at` er null (altså til spilleren har trykket «Gå inn»), og ikke midt i en kamp. Det betyr at de som ble flyttet av migreringen, også får se den neste gang de åpner appen.
