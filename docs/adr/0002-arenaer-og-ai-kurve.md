# Arenaer i AI-sesongen og hvordan AI-en blir vanskeligere

Mange managere hadde nådd divisjon 1–3, og AI-sesongen trengte mer å klatre i. Vi la til fem arenaer med ti divisjoner hver, som i Clash Royale, der vinneren av divisjon 1 går til neste arena og divisjon 10 er gulvet i hver arena. Det vanskelige var hvordan AI-en skal bli bedre når ratingen stopper på 99 og AI-favoritten i divisjon 1 allerede lå på 99.

Vi valgte at AI-ratingen ikke er det eneste som skiller arenaene. Fra arena 2 er AI-klubbene jevnere (mindre avstand mellom svakeste og beste klubb), de har en skjult styrkebonus i kampmodellen (+1 til +4) som ikke vises som rating, og AI-spillerne kan være opptil 99. Et alternativ var å strekke den gamle kurven over alle 50 divisjonene, men da ble hvert steg nesten umerkelig.

Simulering med den ekte kampmotoren viste at kurven fra før (divisjon 1 = 94, favoritt 99) var nesten umulig å vinne: det beste kortet i katalogen er 92, og det beste mulige laget har snitt rundt 89. Derfor ble AI-ratingen trukket ned og fordelt over arenaene: 58–84, 82–87, 86–90, 88–94 og 91–97. Sesonger som pågikk, fikk de nye ratingene. Med skjult bonus på toppen er Old Trafford og Camp Nou svært vanskelige med dagens katalog. Det er bevisst, men tallene ligger samlet i `src/lib/arenas.ts` og migrering 0062, så de kan justeres når katalogen og spesialkortene gjør lagene bedre.

## Justert i migrering 0107: arena 2–5 var for vanskelige

Med fem arenaer på plass viste det seg at lagene man faktisk kan bygge, ikke kom særlig langt. Vi simulerte hele sesonger med den ekte kampmotoren (ti kamper mot de fem klubbene, AI mot AI med `simulate_ai_goals`, kjemi +2 på begge sider) og telte hvor ofte et lag med en gitt snittrating rykket opp:

| Lag | A1 div 1 | A2 div 1 | A3 div 1 | A4 div 1 | A5 div 1 |
| --- | --- | --- | --- | --- | --- |
| Snitt 90, før | 18 % | 17 % | 10 % | 2 % | 0 % |
| Snitt 94, før | 45 % | 40 % | 13 % | 5 % | 0 % |

Selv i divisjon 10 i arena 4 og 5 rykket et lag på 90 bare opp 23 % og 8 % av sesongene. AI-ratingen pluss den skjulte bonusen (+4 på Camp Nou) pluss kjemien lå over det laget kan bli: det beste kortet i katalogen er 92, og snittet i det beste mulige laget er rundt 89–92. Kampmotoren er flat, så en ratingforskjell på 5 gir bare omtrent ett poeng mer eller mindre per fem kamper.

Derfor er ratingene i arena 2–5 trukket ned til 79–84, 81–86, 83–88 og 85–90, og den skjulte bonusen er 0, 1, 1 og 2 (arena 1 er som før). Med det rykker et lag på 90 opp omtrent 85 % av sesongene i divisjon 10 i arena 2, 75 % i arena 3, 65 % i arena 4, 50–60 % i arena 5, og 5–10 % i divisjon 1 på Camp Nou; et lag på 94 har rundt 20 % der. Toppen av stigen er fortsatt for de beste lagene, men ikke umulig. Sesonger som pågår, fikk de nye ratingene på kampene som ikke er spilt. Simuleringen bruker lag der alle på banen har samme rating, så ekte lag med blandet rating kan komme litt annerledes ut. Den ligger i `scripts/simulate-arenas.mjs` (`npm run sim:arenas`). Ser det for lett eller for hardt ut etter noen uker, er det bare ratingene og bonusene i `src/lib/arenas.ts` og en ny migrering som skal justeres.
