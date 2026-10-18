# Futebol

En app for å holde styr på en simulert fotball-managerkarriere med spillerkort, og separat på egne EA FC/NHL-turneringer venner spiller mot hverandre.

## Language

**Quiz**:
Fotballquizen på `/quiz`, som virker uten innlogging og uten nett. Alt skjer i nettleseren: spørsmålene ligger i koden, og rekorder og statistikk lagres bare på enheten (localStorage). Ingenting synkes til kontoen. Har ni typer (blandet, klassisk, sant/usant, spillerbilde, klubbmerke, flagg, karrierevei, eldste klubb, årstall) og fire spillmoduser (klassisk, tidsjakt, overlevelse, sofaduell), pluss **Dagens quiz**.
_Avoid_: Trivia alene, Offline-modus (quizen er modusen; resten av appen trenger fortsatt nett)

**Managerkarriere**:
Den kortbaserte modusen der du bygger en tropp av spillerkort, kjøper i katalogen, kjøper/selger på overgangsmarkedet og spiller simulerte kamper mot venners tropper. Alt skjer inne i appen. Den eneste premien er opprykk i AI-sesongen, som gir MB og en **pakke**.
_Avoid_: Karriere alene (tvetydig med Turnering)

**Turnering**:
En serie ekte EA FC- eller NHL-kamper som venner spiller på selve spillkonsollen/PC-en, der appen kun brukes til å registrere resultatene og holde oversikt (kamplogg, tabell). Appen simulerer ikke disse kampene.
_Avoid_: Karriere, Manager-turnering

**Sesong**:
En avgrenset periode i Managerkarrieren med en tabell og et sluttresultat/premie. Finnes i to varianter, se **AI-sesong** og **Vennesesong**.
_Avoid_: Liga (brukes ikke som eget begrep ennå), Karriere

**AI-sesong**:
En sesong der motstanderne er de andre brukernes lag (spillerne deres, og laget heter det brukeren heter), skalert til styrken divisjonen krever. Lave nivåer møter de svakeste lagene, de høyeste nivåene de beste. Er det for få brukere med gyldig ellever, fylles resten med oppdiktede AI-klubber. Motstanderen merker ingenting: ingen premie, ingen kamp i historikken. Fungerer for én enkelt spiller. Har en **divisjon**: klarer du deg godt nok gjennom sesongen, rykker du opp til en vanskeligere divisjon neste sesong.
_Avoid_: Karrieresesong, Solo-sesong

**Vennesesong**:
En sesong der tabellen består av deg og venner som spiller managerkarrieren sammen; alle kampene er mot hverandre, ikke mot AI. Med 10 eller færre managere spilles det **dobbel serie** (alle møter alle hjemme og borte), med flere møtes alle én gang. Vennesesonger gir ingen premie. Du kan invitere venner direkte, og hver vennesesong har også en invitasjonslenke som alle kan bli med fra (også de som ikke er venner) fram til sesongen startes.
_Avoid_: Liga, Turnering (Turnering er noe annet, se over)

**Arena**:
Et av fem stadioner i AI-sesongen, som i Clash Royale: Gamle Gress, Ullevaal, Wembley Stadium, Old Trafford og Camp Nou. Hver arena har ti **divisjoner**, så stigen er 50 nivåer lang. Vinner du divisjon 1, går du opp til divisjon 10 i neste arena. Du faller aldri ut av en arena du har nådd. AI-klubbene blir jevnere og får en skjult styrkebonus jo høyere arenaen er, og opprykkspremien ganges opp.
_Avoid_: Liga, Nivå, Stadion alene (Stadion er navnet, Arena er nivået)

**Stadion**:
Managerens eget stadion, som en Clash of Clans-base (migrering 0123, ADR 0004). Alle starter likt, uansett arena, divisjon eller klubbnivå, og stadionet gir ingen fordel i selve kampene. Syv bygninger oppgraderes med MB og tid: **klubbhus** (setter taket for de andre og gir flere byggere), **billettluke** (gruve som lager MB), **kasse** (lager som bestemmer hvor lenge billettluka og treningsfeltet kan fylle seg opp), **treningsfelt** (lager klubb-XP), **tribune** (mer MB fra billettluka), **supporterfelt** (dugnad: kortere byggetid) og **speiderhytte** (en speider er ute i 24 timer og kommer hjem med en pakke eller en spiller på 87–94 som man kan kjøpe, med rating og pakke etter hyttas nivå; man velger alltid én). Samlerne må tømmes, og tiden de sto fulle er tapt. Pågående oppgraderinger kan gjøres ferdige mot MB (20 MB per time som er igjen, gratis de siste 5 minuttene). Alt ligger i `src/lib/stadium.ts`. Heter «Stadium» på engelsk.
_Avoid_: Arena (arenaen er vanskelighetsnivået på stigen, ikke managerens eget stadion), Klubbanlegg

**Divisjon**:
Et av ti vanskelighetsnivåer i hver **arena** (Divisjon 10 lavest, Divisjon 1 høyest), der AI-troppenes samlede rating skaleres opp jo høyere divisjon. Etter en AI-sesong rykker topp 2 opp i divisjon 10–7 og bare vinneren i divisjon 6–1; vinneren av divisjon 1 går til neste arena. Plassen rett under spiller **kvalik**. De to nederste rykker ned, unntatt i divisjon 10, som er gulvet i arenaen. Belønningen for opprykk øker jo høyere divisjonen du rykker opp til er.
_Avoid_: Nivå (brukes om klubbnivå/XP, som er noe annet), Liga

**Mestertittel**:
Det du får når du vinner divisjon 1 på Camp Nou, den siste arenaen. Du blir der og kan vinne flere; antallet vises på arenaveien.
_Avoid_: Mesterskap, Trofé

**Kvalik**:
Én ekstra kamp etter en AI-sesong for den som havner rett under opprykksplassene, mot en klubb fra divisjonen over (fra divisjon 1: en klubb fra divisjon 10 i neste arena). Kampen må ha en vinner, og bare seier gir opprykk. Den teller ikke i tabellen.
_Avoid_: Playoff, Omspill


**SBC**:
Slått av i migrering 0081, siden ingenting gir premie lenger utenom opprykk. En utfordring i Managerkarrieren der du leverer inn et bestemt antall kort som oppfyller kravene (f.eks. snitt-rating eller antall fra én liga) og får en premie i MB eller pakker. Kortene du leverer er borte for alltid. Forsøkene kan være begrenset per dag (nullstilles kl. 18:00 norsk tid) eller per uke (fredag kl. 18:00). Heter «SBC» på alle språk.
_Avoid_: Oppdrag, Utfordring alene (tvetydig med vennekamp-utfordringer)

**Alternative posisjoner**:
De andre posisjonene en spiller også spiller i virkeligheten, ved siden av hovedposisjonen (`position`), f.eks. Kimmich CDM med CM og RB, Mbappé ST med LW og RW, Balde LB med RB. Lagres som `alt_positions` på katalogen og kopieres til kortet når det opprettes (migrering 0110). Listene er hentet fra FotMob (migrering 0112): en posisjon teller når spilleren har spilt den minst 3 ganger og minst 10 % så ofte som sin mest brukte. En spiller kan stå på alle posisjonene sine uten straff (en alternativ CDM, CM eller CAM gjelder bare akkurat den posisjonen, mens hovedposisjonen dekker hele midtbanen), og i kampen spiller han den posisjonen han står på. Kortene viser dem ved siden av hovedposisjonen, og katalogfilteret finner spilleren under alle. Er satt for hele katalogen unntatt ikonene (som er pensjonert og beholder verdiene fra 0110) og noen få spillere FotMob ikke fant; spillere uten alternativ har tom liste og spiller bare hovedposisjonen (pluss posisjonene som allerede regnes som like, f.eks. CDM/CM/CAM). Personlige kort spiller alt uansett («ALL»). Regnes i `canPlayPosition`/`cardCanPlay` i `src/lib/lineup.ts`.
_Avoid_: Sekundærposisjon, Flexposisjon

**Kjemi**:
FC-inspirert bonus i alle kamper i Managerkarrieren (AI-sesong, vennesesong, vennekamper og draft, men ikke Femmer). Hver spiller i elleveren på banen får 0–3 poeng ut fra hvor mange på laget som deler klubb (2/4/7 spillere gir 1/2/3 poeng), liga (3/5/8) og nasjon (2/5/8), kappet på 3, så laget får maks 33. Spilleren teller selv med, og bare spillerne på banen teller: benk og reserver gir ingenting, og kjemien regnes ut på nytt etter bytter og utvisninger. Liga «other» og ukjente klubber gir ingenting, **inform** og **TOTS** regnes som vanlig-kortet, ikoner og **personlige kort** har alltid 3 (ikoner teller dobbelt for nasjonen og som én ekstra for hver liga på laget). Hvert poeng er +1 effektiv rating i kampmotoren, og kortets egen rating endres aldri. Oppdiktede AI-klubber og AI-lagene i draft har en fast kjemi på +2 rating per spiller i stedet. Gjelder kamper fra versjon 7; «Velg beste tropp» og automatiske lag tar hensyn til den. Regnes i `src/lib/chemistry.ts`, ingen databasekolonne.
_Avoid_: Lagånd, Synergi

**Spesialkort**:
Et kort av en spiller som er bedre enn spillerens vanlige kort og har eget utseende. Det er et eget kort: du kan eie både vanlig-kortet og spesialkortet, men bare én av dem kan være i troppen, og de regnes ikke som duplikater av hverandre. Det finnes to typer: **inform** og **TOTS**.
_Avoid_: Spesialutgave, Event-kort

**Inform**:
Spesialkortet for en spiller som er i form denne uken, som Team of the Week i FC. Hver fredag kl. 18:00 velges 23 spillere (en **inform-runde**) etter ekte form: kampkarakterene fra FotMob siste uke (tabellen `fotmob_form`, migrering 0118, fylt av GitHub Actions-jobben «FotMob-form» fredag ettermiddag), først en startellever (1 keeper, 4 forsvarere, 3 midtbane, 3 angrep) og så de 12 beste av resten. Mangler det kampdata, fylles runden med tilfeldige spillere blant topp 400. Fantasy og API-Football ble fjernet i oktober 2026, så rundene var tilfeldige til FotMob tok over (migrering 0118). Kortet er 1–3 bedre (9,0+ i karakter gir +3, 8,0+ gir +2), men alltid mellom 82 og 90: lavere kort løftes til 82, og spillere som er 90 får ikke inform. Har spilleren hatt inform før, bygger det på forrige inform. Jo høyere rating, jo sjeldnere er informen i pakker (vektene ligger i `inform_tiers`; en 90 er omtrent 20 ganger sjeldnere enn en 82). Runden fra 9. oktober 2026 ble valgt for hånd etter FC 27 TOTW 2–4 (migrering 0086). Informs fra før migrering 0082 teller ikke.
_Avoid_: TOTW, Ukens lag

**TOTS**:
Team of the Season, spesialkortet for de beste spillerne i hver liga, som i FC. 200 kort laget én gang (migrering 0065) av spillere fra topp 500: 35 hver fra Premier League, La Liga, Serie A og Bundesliga, alle 26 fra Ligue 1 som er i topp 500, og 34 fra resten av verden, med omtrent en tropps fordeling på posisjoner. Ratingen er 88–95 og følger vanlig-kortet (best vanlig-kort gir 95), og kortet er alltid bedre enn vanlig-kortet. Pakkene gir ikke TOTS lenger (migrering 0082). Heter «TOTS» på alle språk.
_Avoid_: Sesongens lag, Sesong (det er noe annet, se over)

**Inner Peace**:
Spesialkort, femte type (migrering 0116): 34 spillere på 88–95 med temaet ro og flyt fra Kung Fu Panda. Messi er mesteren (Oogway) på 95, og de 33 andre er kjente og lovende spillere fra de fem store ligaene, pluss nordmenn (Martin Ødegaard, Patrick Berg, Jens Petter Hauge, Antonio Nusa og Kristoffer Ajer), som har gjort det best i sesongen 2026/27 ifølge FotMob (snittrating justert for spilletid, valgt 18.10.2026). Ratingen følger formen, men er aldri mer enn 11 over vanlig-kortet, bortsett fra Berg (+16) og Ajer (+13), og best er 94. Spillere som allerede har et honorable mention-kort er ikke med, bortsett fra Nusa. Kortet kommer bare fra pakker som garanterer det, foreløpig Kachow pal (migrering 0117). Lavere rating er vanligere, så 90+ er ca. 37 %. Kortet koster 2 ganger verdien på ratingen. Pakkene trekker bare fra den nyeste runden (migrering 0122 la inn den endelige runden etter at den første allerede var kjørt, og fjernet 20 spillere som bare var i den første, blant dem Thauvin og Mbappé, hos eierne uten erstatning. Eide kort av spillere som er med i begge utgavene er urørt).
_Avoid_: Fred, Zen

**Pakke**:
Et sett tilfeldige spillerkort fra katalogen, kjøpt for MB eller fått ved opprykk, som i FC. Det finnes ni (migrering 0082, 0105 og 0116): Gullpakke (40 MB, 3 kort), Gull spillerpakke (75 MB, 5 kort), Premium gullpakke (100 MB, 6 kort), Sjeldne spillere (200 MB, 5 kort på 80+) Jumbo premium gull (300 MB, 8 kort på 79+, 12 kort frem til migrering 0105), Stjerneutvalg (500 MB, 8 kort på 82+), Formpakka (750 MB, ett garantert spesialkort, inform eller honorable mention, og 5 kort på 83+), Skadoosh dude (1500 MB fra migrering 0116, 1000 MB før, 15 kort på 80+, migrering 0105, maks 1 kjøp per dag fra migrering 0106) og Kachow pal (3500 MB, ett garantert Inner Peace-kort og 8 kort på 86+, garantert ett på 90+ og to på 88+, ca. 9 % sjanse for en Icon). De tre første kan kjøpes fritt, Sjeldne spillere, Jumbo, Stjerneutvalg og Formpakka maks 3 ganger per dag (norsk tid), og Skadoosh dude og Kachow pal maks 1. Eventpakken Ungdomstoooor (50 MB, 6 kort på 78–86, også informs maks 86) kan kjøpes én gang per dag 9.–11. oktober 2026 (migrering 0083 og 0084). Hurtigsalg av en pakke gir godt under prisen tilbake (40–55 %). Hvert kort som ikke er garantert, kan bli en av ukens **informs** (0,1–1 % per kort). Opprykk til divisjon 9–7 gir en Gullpakke, til 6–2 en Premium gullpakke, til divisjon 1 Sjeldne spillere og til en ny arena en Jumbo premium gull.
_Avoid_: Kortpakke, Boks

**Inform-pakke**:
Fjernet, sammen med de gamle pakkene (bronse, sølv, gull, elite, spesialpakken og Ungdomstoooor). Var en pakke til 800 MB som garanterte én inform fra ukens runde.
_Avoid_: Spesialpakke (det er SBC-premien)

**Spesialpakke**:
Premien fra spesial-SBC-en (to kort på 88+): ett tilfeldig spesialkort blant alle som noen gang er laget. Kortet kan ikke selges på markedet. Pakken kan ikke kjøpes.
_Avoid_: Inform-pakke

**Personlig kort**:
Et kort av en ekte manager i appen, med bilde av personen selv. Hver manager kan ha ett, og bare eieren kan ha det: det kan ikke selges, byttes, leveres i SBC, kastes eller trekkes i pakker. Kortet kan spille alle posisjoner. Det starter på 70 og går opp 1 for hvert nytt nivå man når på AI-stigen; det er det høyeste nivået man har nådd som teller, så nedrykk gjør ikke kortet dårligere, og man får ingen oppgradering for å rykke opp igjen til et nivå man har vært på før. Kortet har ikke taket på 99 som alle andre kort. Kortene deles ut for hånd med `grant_personal_card` (migrering 0063). Ved nullstillingen i migrering 0081 ble alle satt til divisjon 10 på Gamle Gress og kortene satt tilbake til 70; de teller bare sesonger etter nullstillingen, så divisjon 1 på Camp Nou gir 119 og første **mestertittel** etter nullstillingen gir 120.
_Avoid_: Ikon, Spesialkort (spesialkort er bedre versjoner av ekte spillere, se over)

**Femmer**:
En egen modus utenfor Managerkarrieren der lagene bare består av **personlige kort**, aldri ekte spillere. Fem står på banen (keeper + fire utespillere) og opptil fem på benken; resten er reserver. Man starter med sitt eget personlige kort (hvis man har ett) og velger resten selv, så man har fem kort. Alle kort starter på 70 her, uansett ratingen i Managerkarrieren, og nye personlige kort er med i galleriet med en gang de deles ut. Kortene blir bedre av XP fra kamper (100 XP = +1). Det finnes ingen pakker, mynter, utfordringer eller informer (fjernet i migrering 0079, da alle kort ble satt tilbake til 70). Hvert kort har en **posisjon** eieren velger (keeper, forsvar, midtbane, angrep), som kan byttes gratis, og kortet er svakere utenfor posisjon. Kampene spilles live med klokke fra serveren og kan ikke hoppes over; på straffer og store sjanser velger den som spiller hjørne eller hvor keeperen kaster seg. Man spiller mot en **AI-stige** med 30 trinn, mot venners lagrede lag eller i en vennesesong (uten premie) (migrering 0075, 0076 og 0079).
_Avoid_: Futsal, 5-er-karriere, Managerkarriere (det er noe annet)


