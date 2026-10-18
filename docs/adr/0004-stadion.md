# Stadion: en base som bygges ut med MB og tid, som i Clash of Clans

Vi trengte en langsiktig bruk for MB og en grunn til å åpne appen flere ganger om dagen, uten å gi folk flere kamper å spille (kampgrensen i `match-limit.ts` er uberørt) og uten å gjøre noen sterkere i kampene. Vi hentet konseptet fra Clash of Clans: hver manager har et **stadion** med bygninger som oppgraderes med MB og tid, byggere som bare kan jobbe med noen få ting om gangen, samlere som fylles opp og må tømmes, og mulighet til å skynde på byggingen mot betaling.

## Alle starter likt

Alle starter på samme nivå på sitt eget stadion, uansett arena, divisjon, klubb-XP eller hva de ellers har oppnådd. Det de allerede har oppnådd, beholder de, men ingenting av det gir forsprang her: stadionet leser ingenting fra arenaer, divisjoner eller klubbnivå. Flere byggere låses opp med klubbhuset (i Clash kjøper man dem med edelstener), ikke med fremgang andre steder. Dermed kommer man bare lengre i stadionet ved å bruke tid og MB på det.

## Hva det er

Syv bygninger, med nivå opp til 5 eller 10 (alle tallene ligger i `src/lib/stadium.ts`):

| Bygning | Start | Maks | Hva den gjør |
| --- | --- | --- | --- |
| Klubbhus | 1 | 5 | Setter taket for de andre (2 nivåer per klubbhusnivå) og gir byggere: 2 til å begynne med, så én til for hvert klubbhusnivå fra 3, opp til 5. |
| Billettluke | 1 | 10 | Gruva: lager 1–12 MB i timen døgnet rundt. |
| Kasse | 1 | 10 | Lageret: bestemmer hvor mange timer med produksjon billettluka og treningsfeltet kan fylle seg opp (6–48 timer) før de stopper. |
| Treningsfelt | 0 | 10 | Lager 1–15 klubb-XP i timen på samme måte. |
| Tribune | 0 | 10 | Gir 4 % mer inntekt fra billettluka per nivå (opp til +40 %). |
| Supporterfelt | 0 | 10 | Dugnad: alle oppgraderinger blir 2 % raskere per nivå (opp til 20 %). |
| Speiderhytte | 0 | 10 | Sender ut en speider i 24 timer. Han kommer hjem med en pakke eller en spiller du kan kjøpe. |

Oppgraderinger koster MB og tar fra 10 minutter til 5 dager (før dugnaden). Hver byggher jobber med én ting om gangen, men med flere byggere kan flere ting bygges samtidig, som i Clash. Vi startet først med én byggher, men det ble for tregt sammenlignet med Clash, så alle starter nå med to. Vi har ikke bekreftet hvor mange byggere Clash starter med (kildene var uklare), bare at hver byggher tar én oppgradering om gangen og at man kan ha opptil fem eller seks. Samlerne fylles opp til kassas kapasitet og må tømmes, og tiden de sto fulle er tapt, som i Clash. Bygget er ferdig når tiden er ute, uansett om appen er åpen.

**Hurtigbygging mot MB.** En pågående oppgradering kan gjøres ferdig med en gang: 20 MB per time som er igjen, og gratis de siste 5 minuttene (som i Clash). Det er det eneste stedet MB kan kjøpe tid, og det betyr at den som har mest MB kan bygge raskest. Det er et valg vi tok, og taket på hvor mye en bygning gir, er det som begrenser hva det kan bli til.

**Speiderhytta.** Nivået på hytta avgjør hva speideren finner. Spilleren er en tilfeldig aktiv spiller i katalogen som manageren ikke eier fra før, med rating fra 87 på nivå 1 til 92–94 på nivå 10 (trinnene står i `scoutRatings`), og koster 60 % av katalogprisen (katalogprisen er kortets verdi: 280 MB for en 87-er og 2000 MB for en 93–94-er, så 168–1200 MB). Hurtigsalg gir bare 25 %, så det er ingenting å tjene på å kjøpe og selge. Pakka er en av de eksisterende pakkene, bedre jo høyere nivå: Premium gullpakke på nivå 1–2, Sjeldne spillere på 3–4, Jumbo premium gull på 5–6, Stjerneutvalg på 7–8 og Formpakka på 9–10. Manageren velger alltid mellom spilleren og pakka, og begge avslutter oppdraget. Kjøper man spilleren, bruker det samme plass- og duplikatregler som katalogkjøp (men uten taket på 83 i rating, siden det er poenget). Pakka havner i gratispakkene og åpnes som alle andre.

## Tegningen vokser med nivåene

Stadionet er en tegnet scene (`src/components/stadium-scene.tsx`), ikke ikoner på en grønn flate. Alt som tegnes leses fra nivåene, så tegningen er ren pynt og påvirker ingenting i spillet. Det som skjer når man oppgraderer:

- **Tribune** er selve stadionet, tegnet isometrisk i 3D (`src/components/stadium-arena.tsx`). Nivå 0 er en bar bane med gjerde. Nivå 1 er en liten hovedtribune, og hvert nivå legger til seterader. Nivå 3 gir tribune langs en side og de første lysmastene, nivå 4 tak over hovedtribunen, nivå 5 en lav tribune i enden med fasade, buer og hovedinngang, og nivå 6 en øvre etasje, tak på langsiden og flere master. Nivå 7 gir den siste siden og videotavle, nivå 8 glasstak og lysstråler, nivå 9 en lysende LED-stripe og en rad til i øvre etasje, og nivå 10 har monument ved inngangen. Kapasiteten (`seatsOf`, 200 til 80 000 plasser) står over scenen.
- **Supporterfelt** fyller plassene: jo høyere nivå, jo tettere sitter fansen, og fra nivå 6 er det tre farger. Selve feltet får flere fans, vimpler, tromme, tifo-banner og røykbomber.
- **Klubbhus** går fra et lite hus med saltak til en borg med glassatrium og gullkuppel. **Kasse**, **billettluke**, **treningsfelt** og **speiderhytte** får hver sin utvikling (søyler og gullbarrer, flere luker og kø, gjerde og lys, speidertårn med radar).
- En bygning på nivå 0 er en tom tomt. En bygning som oppgraderes vises som før med en byggekran til den er ferdig, og «popper» opp når den får nytt nivå.

Under en oppgradering står det en byggekran ved bygningen. **Kveldsmodus og feiring.** Knappen øverst til venstre i scenen (🌙/☀️) slår på flomlysene: scenen mørkner, og lyset fra mastene lyser opp banen. Jo flere master (to fra tribunenivå 3, fire fra 6), jo større lysflate, så uten master er det ingenting å se i mørket (`floodlights` i `stadium-arena.tsx`, `NightLayer` i `stadium-scene.tsx`). Som standard følger den klokka (kveld og natt fra 19 til 6), og valget huskes bare i denne nettleseren. Når tribunen får nytt nivå, tennes flomlysene med rakettbyger, konfetti og en melding som forsvinner av seg selv etter fem sekunder. Feiringen kommer også hvis nivået økte mens man var borte, siden det sist sette nivået ligger i nettleseren (`stadium-tribune-seen`). Første gang man åpner stadionet feires ingenting. Uten lagring feires bare det man ser komme. Alt er ren pynt.

Knappene, boblene og nedtellingene er vanlig HTML lagt over tegningen med posisjonene i `sceneSpots`, så tilgjengelighet og klikk virker som før. Tilfeldige posisjoner (fansene) kommer fra en heltallshash, ikke `Math.sin`, fordi Node og nettleseren runder ulikt og det ga hydreringsfeil.

## Valg vi tok

**Lat ferdigstilling.** En oppgradering lagrer bare nivået den går til og når den er ferdig (`upgrade_to`, `upgrade_ends_at`). Ingen jobb kjører i bakgrunnen. Les-koden regner en oppgradering som utført når tiden er passert (`effectiveLevels`), og skrivefunksjonene i databasen rydder opp først (`stadium_settle`). Alternativet var en planlagt jobb som flytter nivåene, men det gir mer å drifte og ingenting å vinne.

**Tallene bor i TypeScript, ikke i SQL.** Til forskjell fra arenaene (ADR 0002), som er speilet i SQL, får databasefunksjonene pris, tid, produksjon og hva speideren skal finne fra serverkoden. De kan bare kalles med service-nøkkelen (`revoke` fra alle andre), så parameterne er ikke noe brukeren kan sende selv. Databasen passer på det som må være atomisk: pengene, at byggeren er ledig, at nivåene tas i rekkefølge, at klubbhuset er høyt nok, og at speideren bare gir ett valg. Dermed endres balansen på ett sted. Prisen på hurtigbygging regnes ut i databasen fra tiden som faktisk er igjen. Funksjonene svarer med en årsak (`no_money`, `busy` osv.) i stedet for å kaste feil, så de trenger ingen regler i `src/i18n/db-errors.ts`.

**Ingen effekt i kampene.** Stadionet påvirker ikke kampmotoren. En tidligere versjon hadde en hjemmebanebonus fra tribunen; den er fjernet, siden alle skulle starte likt og ingen skulle få en fordel i kampene av noe som kan kjøpes med tid og MB. Tribunen gir i stedet mer MB, og det eneste som kan gi en fordel i spillet er MB og kortene som kan kjøpes for dem, som før.

**Speiderens forslag lagres.** Første gang manageren åpner det speideren fant, trekkes spilleren og lagres på oppdraget (`stadium_scouts.offer`), så forslaget står fast om man laster siden på nytt og man ikke kan trekke på nytt til man får en bedre spiller.

**Inntekten legges også i `manager_budget_earned`**, som all annen inntekt. XP fra treningsfeltet går via `grant_club_xp`.

## Ting vi ikke har bekreftet

- **Balansen er ikke simulert mot ekte tall.** Vi har ikke hatt tilgang til hvor mye MB som går inn og ut i produksjon. Med full billettluke (12 MB i timen, +40 % fra tribunen, kasse som rommer 48 timer) er maksimalt rundt 400 MB per dag om man tømmer jevnlig, mens en pakke på 1500 MB har en daglig grense på ett kjøp. Hurtigbygging og speiderpakkene (opptil 750 MB verdi per døgn på nivå 9–10) gjør dette til en betydelig kilde til MB og kort. Alt er satt for å være en langsiktig investering, men det må sjekkes mot ekte tall en uke eller to etter utrulling og justeres i `stadium.ts` uten ny migrering.
- **Alle starter på samme tidspunkt.** `stadium_collected_at` og `stadium_xp_collected_at` får standardverdien `now()`, så ingen får opptjent inntekt fra før migreringen. Treningsfeltet begynner å samle når det står ferdig.
- **Nullstilling:** stadionet nullstilles ikke når managerkarrieren nullstilles.
- **Arbitrasje på markedet:** spilleren kjøpes til 60 % av verdien og kan ligge ute på overgangsmarkedet til høyere pris. Det er én spiller om dagen og man kan ikke velge hvem, men det er en vei for MB å gå rundt.

## Ikke med i første versjon

- Rutenett der man plasserer bygningene selv (de står på faste plasser i scenen, se `sceneSpots`).
- Raid på venners stadion, og å se en venns stadion.
- Flere bygninger: flomlys (kveldskamper), murer og forsvar.
- Å avbryte en oppgradering mot refusjon.
- Å hurtigbygge speideren.
