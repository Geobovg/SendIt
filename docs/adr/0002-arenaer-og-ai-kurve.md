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

Derfor er ratingene i arena 2–5 trukket ned til 80–85, 82–87, 84–89 og 85–90, og den skjulte bonusen er 0, 1, 1 og 2 (arena 1 er som før). Med det rykker et lag på 90 opp omtrent 80 % av sesongene i divisjon 10 i arena 2, 70 % i arena 3, 60 % i arena 4 og 47 % i arena 5. I divisjon 1 er sjansen rundt 30 %, 20 %, 13 % og 10 %, og et lag på 94 har rundt 20 % på Camp Nou. Toppen av stigen er fortsatt for de beste lagene, men ikke umulig. Sesonger som pågår, fikk de nye ratingene på kampene som ikke er spilt. Simuleringen bruker lag der alle på banen har samme rating, så ekte lag med blandet rating kan komme litt annerledes ut. Den ligger i `scripts/simulate-arenas.mjs` (`npm run sim:arenas`). Ser det for lett eller for hardt ut etter noen uker, er det bare ratingene og bonusene i `src/lib/arenas.ts` og en ny migrering som skal justeres.

## Justert i migrering 0108: hele stigen var for vanskelig

Etter 0107 hadde et lag på 90 fortsatt bare rundt 25–30 % sjanse for opprykk fra divisjon 1 både i Gamle Gress og på Ullevaal, og et 90-lag tar tid å bygge. Toppen av Gamle Gress (84, favoritt 89) var dessuten like vanskelig som toppen av Ullevaal. Kampmotoren har mye tilfeldighet, og fra divisjon 6 må man vinne serien, så selv et lag som er klart bedre enn snittet taper ofte serien til favoritten.

Derfor er hele stigen trukket ned: 58–80, 76–81, 77–82, 79–84 og 81–86. Favoritten ligger nå +3 over divisjonsratingen i arena 1 og +2 i resten (var +5 og +3 i arena 1 og 2), og den skjulte bonusen er 0, 0, 1, 1 og 1. Simulert med 300 sesonger, uten kvalik for andreplass (tallene svinger 5–10 prosentpoeng mellom kjøringer):

| Lag | A1 div 1 | A2 div 1 | A3 div 1 | A4 div 1 | A5 div 1 |
| --- | --- | --- | --- | --- | --- |
| Snitt 90 | 54 % | 50 % | 40 % | 33 % | 21 % |
| Snitt 94 | 79 % | 75 % | 68 % | 55 % | 45 % |

Divisjon 10 i neste arena er fortsatt lettere enn divisjon 1 i arenaen før, så det er ingen vegg rett etter et arenaopprykk. Samtidig sluttet brukerlag som motstandere å bli fulle av 99-spillere når de ble løftet til divisjonsratingen, noe som gjorde Ullevaal vanskeligere enn simuleringen viste.
