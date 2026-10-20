# Univers: ny start etter Camp Nou

Etter at de første managerne vant divisjon 1 på Camp Nou, var det ingenting mer å vinne. I stedet for en ny nullstilling for alle (som i migrering 0081) sender vi den som vinner til et nytt **univers** med full ny start, mens de som ikke er der ennå, fortsetter som før.

Vi valgte å bytte ut dataene i stedet for å merke alle tabeller med univers. Nesten alle tabeller i managerkarrieren (kort, lag, annonser, sesonger, stadion) er knyttet til brukeren, så `universe_id` overalt ville vært en stor og risikabel endring. Ved flyttingen (`advance_universe`, migrering 0128) lagres derfor laget, kortene, statistikken og sesongene som ett frosset øyeblikksbilde (`universe_archives.snapshot`), og de levende radene nullstilles på samme måte som i 0081, bare for én bruker. Det gamle universet kunne bare ses, siden det ikke fantes noen levende rader å spille med. Det ble endret i migrering 0129, se under.

Det som er per univers i det levende spillet er `player_profiles.universe`: `pick_season_opponents` henter bare motstandere fra samme univers, og overgangsmarkedet (liste, bud og kjøp) er adskilt i serverkoden (`src/lib/universe.ts`, `src/lib/market-actions.ts`). Vennekamper og vennesesonger går på tvers. Arenaene har nye navn og farger i hvert annet univers (`arenasOf` i `src/lib/arenas.ts`), men tallene (rating, bonus, premiefaktor) er de samme, så vanskeligheten er uendret.

Klubbnivå og XP, venner, profil, Femmer, turneringer og det personlige kortet beholdes, siden de er kontoens, ikke karrierens. Det personlige kortet settes tilbake til 70 som ved 0081. MB og stadion starter på nytt (120 MB, stadion på nivå 1).

Overgangsanimasjonen vises når `universe_archives.seen_at` er null (altså til spilleren har trykket «Gå inn»), og ikke midt i en kamp. Det betyr at de som ble flyttet av migreringen, også får se den neste gang de åpner appen.

## Spille videre i et gammelt univers (migrering 0129)

Spillerne ville fortsatt kunne gjøre alt unntatt AI-ligakamper i universet de har vunnet: draft, pakker, vennekamper, 1 mot 1 og stadion. Vi valgte fortsatt ikke å merke tabellene med univers. I stedet byttes de levende radene ut ved universbytte: `stash_universe` lagrer lag, kort, MB, pakker, valg, stadion, sesonger og arenaer som JSON i `universe_saves` og tømmer de levende radene, og `restore_universe` setter det andre universets rader inn igjen (`switch_universe`). Det betyr at all eksisterende kode virker i alle universer uten endringer. MB, pakker og stadion er adskilt per univers. Det personlige kortet er kontoens, men ratingen og stigestartpunktet lagres per univers.

Et univers der Camp Nou er vunnet, får `player_profiles.league_closed`. `ensure_ai_season` lager da ingen sesong, og siden viser en «ligaen er ferdig»-flate med snarveier i stedet for en ligakamp. Vi tar ikke vare på mer enn det som skal til, så en tabell som får en ny `not null`-kolonne uten at `restore_universe` oppdateres, vil ikke kunne gjenopprette gamle lagringer. Byttet er blokkert mens en kamp eller draft pågår, siden draften gir MB til universet du er i.

De som ble flyttet av 0128 hadde allerede mistet de levende radene i det gamle universet. 0129 bygger opp startellever og benk igjen fra `universe_archives.snapshot` og setter MB til 120 med nytt stadion. Resten (MB-saldo, stadion og kort utenfor laget) finnes ikke i arkivet og må hentes fra en backup av databasen.
