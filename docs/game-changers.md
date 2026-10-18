# Game changers: idéer fra andre spill og sporter

Idébank, ikke et løfte. Hver idé er hentet fra et kjent spill eller en sport og passer mot noe vi allerede har
(kampmotoren i `src/lib/manager-match.ts`, kjemi, pakker, arenaer, draft, vennesesong, byttevindu og live-straffer).
Innsats er grovt anslått: **S** = noen timer, **M** = en til to dager, **L** = flere dager med ny database og ny skjerm.

## Topp 5 (mest effekt for innsatsen)

| # | Idé | Hentet fra | Innsats |
| --- | --- | --- | --- |
| 1 | Arcade Run: roguelike-draft med tre liv | Slay the Spire, Balatro, arkade («Continue?») | L |
| 2 | Helgeligaen: ti kamper fra fredag til søndag, premier etter plassering | FUT Champions / Weekend League | M |
| 3 | Samlealbum: fullfør klubb-, liga- og nasjonssett for premie | Panini-album, Pokémon-dex | M |
| 4 | Seiersrekke og «on fire» | NBA Jam, arkade-combo | S |
| 5 | Se venners kamper live med emoji-reaksjoner | Twitch, Fortnite-emotes | M |

## Fra fotball og FC

**Derbyer og rivaler** (FC Rivals, lokaloppgjør) – S/M
Møter du en klubb eller en venn du har spilt mot mange ganger, blir det et derby: ekstra kjemi- eller ratingvekt
(`ratingWeight` finnes allerede i kickoff-eventet), eget merke i kamplisten og «head-to-head» på lagvinduet.
Et revansjeknapp-valg etter tap i vennekamp koster nesten ingenting å legge til.

**Taktikk i kampmotoren** (Football Manager) – L
Formasjon og stil (press, kontring, possession) som velges før kampen og kan byttes i byttevinduet (minutt 70).
Gjør at to like sterke lag spiller ulikt. Stein-saks-papir-effekt mellom stilene er enklest å balansere, og kan
simuleres med samme oppsett som `npm run sim:arenas`.

**Deadline Day** (overgangsvinduet) – M
Fredag kl. 18:00 er allerede dagen informene kommer. Gjør det til en markedstime: auksjoner som går ut samtidig,
tidsbegrenset prisfall på utvalgte kort og en nedtelling på forsiden. Overgangsmarkedet og chatten finnes fra før.

## Fra arkade og roguelike

**Arcade Run** (Slay the Spire, Balatro, «Insert coin / Continue?») – L
Ny modus ved siden av sesongene: du får tre liv og et tilfeldig draftet lag (`draft-core.ts` finnes), og møter åtte
motstandere med økende styrke og en sjef til slutt. Mellom kampene velger du ett av tre nye kort eller en
boost. Taper du tre ganger, er runnen slutt. Gir kort, intense økter og en ny grunn til å åpne appen daglig.

**Seiersrekke og «on fire»** (NBA Jam, Pac-Man-combo) – S
Tre seire på rad gir en synlig rekke med flamme på laget og litt ekstra MB. En spiller som scorer to ganger i en
kamp, er «on fire» resten av den kampen (+1 effektiv rating, akkurat som kjemi). Rekken brytes av tap, så det
føles som noe å miste.

**Power-ups** (Mario Kart-gjenstander) – M
Engangskort du bruker før en kamp: Regn (utjevner svakt mot sterkt lag), Ekstra bytte (4 i stedet for
`MAX_SUBSTITUTIONS` 3), Heimebane (+1 kjemi), Straffesjanse (garantert én straffe). Kommer fra pakker og
daglig spinn. Hold dem små: maks ett per kamp, og ingen kan kjøpes med ekte penger.

**Dagens hjul og dagsserie** (arkadehjul, mobilspill) – S
Gratis spinn én gang om dagen med små premier, og en serie for å logge inn flere dager på rad.
Ingen ny kampmotor, bare en tabell og en knapp.

**Highscore-liste med initialer** (arkade) – S/M
Globale topplister: lengste seiersrekke, beste Arcade Run, flest mål i en sesong. Quizen har allerede rekorder,
men bare lokalt på enheten; dette er den delte versjonen for managerkarrieren.

**Ferdighetsspill** (FIFA Skill Games) – M
Daglig minispill i samme stil som straffene (`TimelineShot`): frispark med vind, eller å treffe tre
målmann-hull på 20 sekunder. Premien er MB eller en pakke, og det trener spilleren på det som avgjør live-kampene.

## Fra andre sporter og kortspill

**Samlealbum** (Panini, Pokémon) – M
Fullfør et sett (alle fra Bundesliga-TOTS, alle norske spillere, alle keepere over 85) for en fast premie. Dette
fyller tomrommet etter SBC, som ble slått av i migrering 0081, uten at kort går tapt for alltid.

**Plasseringskamper og rangering** (Rocket League, Valorant) – M
Nye spillere spiller fem plasseringskamper som setter startdivisjon i stedet for at alle starter på Gamle Gress
divisjon 10. Fjerner den tomme starten for dem som er gode, og passer med arenastigen.

**Golden goal i ekstraomgangene** (ishockey, Rocket League overtime) – S
Første mål avgjør i ekstraomgangene. `EXTRA_TIME_END` og straffekonkurransen finnes, så det er en regel i
motoren og ikke en ny skjerm. Gir mer dramatikk i kvalik og cup.

**Cup med trekning** (Champions League, FA-cupen) – M
Ukentlig utslagscup for alle som melder seg på: trekning fredag, én runde per dag, vinneren får en pakke. Kickoff-
eventet har allerede `knockout`-flagg.

**Klubber med felles mål** (Clash Royale-klaner) – L
Små klubber på opptil 20 managere med felles sesong og felles mål (f.eks. 100 seire i uken). Bygger på
vennesesongene og invitasjonslenkene.

## Fra strømming og sosiale spill

**Se venners kamper live med emoji** (Twitch, Fortnite) – M
Kampene er allerede live og klokkestyrt fra serveren, så en tilskuervisning er mest et spørsmål om en
realtime-kanal og en rad med reaksjoner som flyter over banen.

**Sesongpass** (Fortnite, Clash Royale) – L
Gratis belønningsspor per sesong som fylles av XP fra kamper. Ingenting betales, og alt er tidsbegrenset, noe som
gir en grunn til å spille jevnt. Må planlegges sammen med pakkeprisene, ellers blir økonomien ødelagt.

## Anbefalt rekkefølge

1. **Seiersrekke og «on fire»** + **Golden goal**: små, trygge endringer som merkes med en gang.
2. **Helgeligaen**: bruker kampene og fredag kl. 18:00-rytmen vi har, og gir en ukentlig grunn til å komme tilbake.
3. **Samlealbum**: gir kortene i samlingen en ny verdi.
4. **Arcade Run**: den store, og bør få egen ADR i `docs/adr` før noen begynner.

## Åpne spørsmål

- Skal premier alltid være MB og pakker, eller skal noe være bare ære (titler, merker)?
- Hvor mye ekstra MB inn i økonomien tåler markedet før kortene mister verdi?
- Skal nye moduser telle mot dagsgrensen for kamper (`match-limit.ts`), eller ha egne grenser?

---

# Runde 2: flere forslag

Samme skala som over (S/M/L). Disse er mer rettet mot selve kampopplevelsen, kortutvikling og det sosiale mellom
venner, siden første runde mest handlet om nye moduser.

## Topp 5 i runde 2

| # | Idé | Hentet fra | Innsats |
| --- | --- | --- | --- |
| 1 | VAR-utfordring: én overprøving per kamp | Tennis (Hawk-Eye), cricket (DRS), NFL (challenge) | M |
| 2 | Evolusjoner: oppgrader et kort ved å løse oppgaver med det | FC Evolutions, Pokémon | M |
| 3 | Ukens brawl: regelsett som skifter hver uke | Hearthstone Tavern Brawl, Mario Kart-cuper | S/M |
| 4 | Tipp ekte kamper mot venner | Premier League Predictor, tippeligaer | M |
| 5 | Sesong-Wrapped: delbart oppsummeringskort | Spotify Wrapped | S/M |

## I selve kampen

**VAR-utfordring** (tennis, cricket DRS, NFL challenge) – M
Hvert lag har én utfordring per kamp som kan brukes på et mål mot deg, en straffe eller et rødt kort. Utfallet
trekkes med samme sannsynlighetsmotor som skuddene (rundt 30 % at dommeren snur), og en mislykket utfordring
koster den. Gir en ny avgjørelse midt i live-kampen og spenning rundt hver tvilsom hendelse.

**Mega-skudd** (Mario Strikers, Sensible Soccer) – M
Én ladet sjanse per kamp: spilleren holder inne for å lade, og skuddet blir vanskeligere å redde, men har lavere
sjanse for å treffe rammen hvis man lader for lenge. Bygger på valgvinduet i `TimelineShot` (`SHOT_CHOICE_MS`).

**Spillerroller** (Football Manager, NHL-linjer) – L
Hver spiller får en instruks (f.eks. «blir bak», «går fremover», «bærer ballen»). Roller fordeler hvem som får
sjanser og hvem som scorer, og gir en grunn til å bruke alternative posisjoner, som allerede finnes.

**Handikap i vennekamper** (golf, Mario Kart gummibånd) – S
Når et lag er mye sterkere enn det andre, gis det svakeste en liten ratingjustering automatisk (valgfritt, slått av
i sesonger). Gjør at venner med ulikt nivå fortsatt har en jevn kamp. `ratingWeight` i kickoff-eventet viser at motoren
allerede har et sted for dette.

## Kortene og samlingen

**Evolusjoner** (FC Evolutions) – M
Et kort kan «evolveres» ved å fullføre krav mens det står i troppen: spille 5 kamper, score 3 mål, holde nullen
to ganger. Belønningen er +1 til +3 rating eller en ny alternativ posisjon. Gir duplikater og lavt vurderte kort
en bruk, og setter en naturlig grense (maks tre evolusjoner per kort).

**Spillerform med piler** (FIFA, Football Manager) – S/M
Kortet viser en pil opp eller ned etter hvor bra spilleren er i form i ekte fotball. Dataene hentes allerede fra
FotMob (`fotmob_form`, migrering 0118). Pilen kan også gi ±1 i kamp, så det lønner seg å følge med på formen.

**Live-oppgradering fra ekte kamper** (FIFA Live, Fantasy) – M
Gjør en spiller hat-trick i en ekte kamp, får kortet hans +1 til neste fredag. Samme FotMob-kilde som over, og gir
en grunn til å følge ekte fotball på helgene.

**Speidere** (Clash Royale-kister, Football Manager, idle-spill) – M
Send en speider til en liga eller nasjon i 8 timer, og han kommer tilbake med ett kort fra den. Én plass i
begynnelsen, flere med nivået. Gir en grunn til å åpne appen to ganger om dagen.

## Det sosiale

**Draft mot venner** (NFL/ESPN snake draft) – L
Vennene drafter samtidig i en felles pool, og hver spiller kan bare tas av én. Så møtes lagene i en vennesesong.
`draft-core.ts` finnes, men i dag er motstanderne AI.

**Ukens brawl** (Hearthstone Tavern Brawl, Mario Kart-cuper) – S/M
Et regelsett som skifter hver uke og gir en egen liten tabell: bare spillere under 80, bare nordmenn, bare én
liga, maks total rating 900. Billig å lage fordi det bare er et filter på troppen, og gir variasjon uten ny motor.

**Tipp ekte kamper** (Premier League Predictor) – M
Tipp resultatene i helgens ekte kamper mot vennene dine og få MB for riktig utfall. FotMob-oppsettet i
`scripts/fotmob` henter allerede ligadata, så terminlisten er ikke noe nytt.

**Trofeskap og merker** (Xbox/PlayStation-trofeer) – S/M
Små merker for ting du har gjort: første 90+ i pakke, 10 seire på rad, mestertittel, 100 kamper. Vises på profilen og
kan deles. Billig, og gir en grunn til å fullføre ting som ikke har premie fra før.

**Dagens spiller** (Wordle, Immaculate Grid) – S/M
Et daglig puslespill i quizen: gjett spilleren ut fra klubbene, nasjonen og alderen, med seks forsøk. Quizen
virker uten innlogging og uten nett, så dette kan bli innfallsporten for nye brukere, og resultatet kan deles som
emoji-ruter.

**Sesong-Wrapped** (Spotify Wrapped) – S/M
Når en sesong er ferdig, lages et delbart kort: flest mål, beste spiller, lengste rekke, mest brukte formasjon.
Alt ligger allerede i kamplogg og tabell.

## Anbefalt rekkefølge for runde 2

1. **Handikap i vennekamper** og **Ukens brawl**: små, og begge gjør vennekampene jevnere og mer varierte.
2. **VAR-utfordring**: den enkelteste endringen som merkes i selve live-kampen.
3. **Evolusjoner**: gir kortsamlingen en retning, men må balanseres mot pakkeprisene.
4. **Dagens spiller**: lite arbeid, og kan trekke inn nye brukere.

---

# Runde 3: mer arkade

Samme skala (S/M/L). Denne runden er hentet fra arkadehallen: kjappe økter, synlige poeng, sjefer, bonusbaner og
mye «juice». Tanken er at hver økt skal kunne være to minutter, og at det alltid er en grunn til «bare én til».

## Topp 5 i runde 3

| # | Idé | Hentet fra | Innsats |
| --- | --- | --- | --- |
| 1 | Ukens sjef: alle slår samme superlag sammen | Pokémon GO-raids, Destiny, arkadesjefer | M/L |
| 2 | Scenariobaner med 1–3 stjerner | Angry Birds, Super Mario, PES-utfordringer | M |
| 3 | Arkadefølelse i kampen («juice») | Mortal Kombat, NBA Jam, Street Fighter | S |
| 4 | Kaosregler i kampen (mutatorer) | Rocket League Rumble, Mario Party | M |
| 5 | Straffe-rush: 60 sekunder på tid | Arkade-tidsrekorder | S/M |

## Sjefer og baner

**Ukens sjef** (arkadesjefer, Pokémon GO-raids) – M/L
Hver mandag dukker et superlag opp (f.eks. «Galaktisk XI» av 99-spillere) med en felles livslinje som alle
brukere deler. Målene du scorer i kampene mot sjefen, trekker fra livslinjen, og alle kampene teller. Når sjefen
er slått, får alle som har bidratt en pakke, størrelsen etter hvor mange mål de la inn. Gir hele appen et felles
mål og en grunn til å komme innom daglig. Må ha egen tabell for felles skade og et tak per bruker.

**Scenariobaner** (Angry Birds, Super Mario, PES-utfordringer) – M
Håndlagde utfordringer med fast utgangspunkt: «du ligger under 0–2 etter 60 minutter, score tre mål på 30»,
«hold nullen med ti mann», «vinn uten å bruke byttene». Hver bane gir 1–3 stjerner, og stjernene låser opp neste
bane og små premier. Krever at kampmotoren kan starte midt i en kamp (minutt og stilling), men resten av
timeline-eventene er de samme (`MatchClock`).

**Bonusbane etter hver sesong** (Sonic, Pac-Man mellomspill) – S/M
Når sesongen er ferdig, kan du spille én 30 sekunders bonusbane for en liten ekstra premie. Samme minispill som
i straffe-rush under, så koden deles.

## I kampen

**Arkadefølelse («juice»)** (Mortal Kombat, NBA Jam) – S
Skjermristing på mål, «GOAL!» i stor tekst, treghet i et sekund før et straffeskudd, kommentatorlyder og en «PERFECT!»
når du leser keeperen riktig. Ingenting av dette endrer motoren, bare hvordan den kjennes. `audio-player.tsx` og
`scene/`-komponentene finnes allerede.

**Kaosregler / mutatorer** (Rocket League Rumble, Mario Party) – M
Før en kamp, eller i en vennesesong, trekkes en regel: «gullmål» (mål i siste kvarter teller dobbelt), «ti mot ti»,
«ingen keeper de siste fem», «regn» (færre sjanser, flere skudd fra distanse). Ulikt ukens brawl (som filtrerer
troppen) endrer disse selve kampen. Kan legges inn som valgfri regel i vennekamper først.

**Straffe-rush** (arkade-tidsrekorder) – S/M
60 sekunder på å skyte så mange straffer som mulig mot en keeper som blir raskere. Poeng for hvert mål, bonus for
serier, og en global highscore-liste. Samme valgvindu som `TimelineShot`, men uten sesongen rundt.

## Pakker og premier

**Plinko-pakke** (Plinko i The Price Is Right, pachinko) – M
Slipp en ball ned et brett, og hvor den lander, avgjør hvilken pakke du får. Sannsynlighetene ligger i brettets
fysikk, men de må være de samme som vi viser for pakkene (`prosent-sjanse-skal-stemme` er en tidligere sak her).
Kan brukes som daglig gratisforsøk og bygger på animasjonen i `pack-walkout.tsx`.

**Gripekran** (UFO-catcher) – M
En kran med åtte synlige kort. Du styrer den og slipper ned for å gripe ett, og treffer du, er kortet ditt. I
motsetning til en vanlig pakke ser du hva du går etter, så det er en ferdighetsbasert pakke. Kranen fylles på
daglig, og dyrere kort er lettere å miste.

**Spill videre?-stige** (arkadens bonusrunde) – S/M
Etter en seier kan du ta premien eller spille videre for større premie, opp til tre trinn. Et tap tar bort det
som stod på spill. Bruk bare virtuelle MB, ha et lavt tak og la det være valgfritt, siden dette ligner
pengespill og appen har unge brukere.

**Hjerter i stedet for kampkvote** (Candy Crush, Duolingo) – S
Dagens kampgrense (`match-limit.ts`) vises som fem hjerter som fylles med tiden, med nedtelling til neste. Samme regler
som i dag, bare tydeligere, og den som er tom, ser når den får et nytt hjerte.

## Små, billige arkadeting

**Juksekoder** (Konami-koden, spillkoder) – S
Skriv en kode som deles på Discord eller i chatten, og få en liten premie én gang. Koder med navn som `UPUPDOWN` eller
`PIXEL`. Bygger på kodefeltene vi har til invitasjoner og må ha en tabell som begrenser hver kode til én bruker.

**Pixelkort og 8-bit-tema** (retrospill) – S/M
Et valgfritt retro-utseende på kort og banen med pikselert skrift og chiptune. `tournament-theme.tsx` og `theme.ts` har
allerede temasystemet. Kan låses opp ved å fullføre noe, og er rene kosmetiske endringer.

## Anbefalt rekkefølge for runde 3

1. **Juice** og **hjerter**: nesten ingen risiko, og de endrer følelsen av appen med en gang.
2. **Straffe-rush**: gir highscore-lista noe å vise, og kan gjenbrukes som bonusbane.
3. **Scenariobaner**: den beste måten å lære nye spillere kampene på, i tillegg til at de er kjekke for gamle.
4. **Ukens sjef**: den store, og bør få en ADR før den bygges. Spesielt er det verdt å bestemme hvor mye skade
   hver bruker kan legge inn, så ikke de som spiller mest, avgjør alt.
