# Stadion: bygninger som oppgraderes med MB og tid

Vi trengte en langsiktig bruk for MB og en grunn til å åpne appen flere ganger om dagen, uten å gi folk flere kamper å spille (kampgrensen i `match-limit.ts` er uberørt). Vi hentet konseptet fra Clash of Clans: hver manager har et **stadion** med noen få bygninger som oppgraderes med MB og tid, og en byggher som bare kan jobbe med én ting om gangen.

## Hva det er

Tre bygninger, alle med maks nivå 5 eller 10 (tallene ligger i `src/lib/stadium.ts`):

| Bygning | Startnivå | Maks | Hva den gjør |
| --- | --- | --- | --- |
| Klubbhus | 1 | 5 | Setter taket for de andre: nivå 2 per klubbhusnivå. |
| Billettluke | 1 | 10 | Gir 1–12 MB i timen. Lagrer 8 timers produksjon, så den må tømmes jevnlig. |
| Tribune | 0 (må bygges) | 10 | Hjemmebanebonus: +0,1 rating per nivå, opp til +1,0. |

Oppgraderinger koster MB og tar fra 10 minutter til 5 dager. Det er én byggher, så bare én oppgradering kan pågå om gangen (`BUILDERS`). Det finnes ingen måte å hoppe over ventetiden på, og ingenting kan kjøpes med ekte penger. Bygget er ferdig når tiden er ute, uansett om appen er åpen.

## Valg vi tok

**Lat ferdigstilling.** En oppgradering lagrer bare nivået den går til og når den er ferdig (`upgrade_to`, `upgrade_ends_at`). Ingen jobb kjører i bakgrunnen. Les-koden regner en oppgradering som utført når tiden er passert (`effectiveLevels`), og skrivefunksjonene i databasen rydder opp først. Alternativet var en planlagt jobb som flytter nivåene, men det gir mer å drifte og ingenting å vinne.

**Tallene bor i TypeScript, ikke i SQL.** Til forskjell fra arenaene (ADR 0002), som er speilet i SQL, får databasefunksjonene `stadium_start_upgrade` og `stadium_collect` pris, tid og produksjon fra serverkoden. De kan bare kalles med service-nøkkelen (`revoke` fra alle andre), så parameterne er ikke noe brukeren kan sende selv. Databasen passer på det som må være atomisk: pengene, at byggeren er ledig, at nivåene tas i rekkefølge og at klubbhuset er høyt nok. Dermed endres balansen på ett sted. Funksjonene returnerer en årsak (`no_money`, `busy` osv.) i stedet for å kaste feil, så de trenger ingen regler i `src/i18n/db-errors.ts`.

**Hjemmebanebonusen bruker `bonus` på lagoppstillingen som finnes fra før.** Det er den skjulte styrken AI-klubber i arena 3–5 har (`ManagerTeamSnapshot.bonus`), som legges på angrep, forsvar og automatiske sjanser. Derfor trengs ingen ny kampversjon, og gamle kamper beholder modellen de ble startet med. Bonusen legges på hjemmelaget når kampen startes (`withHomeBonus` i `stadium-data.ts`): i utfordringer og vennesesonger er det den som står som hjemmelag, og i AI-sesongen er det alltid deg. Den påvirker hvor ofte lagene lager sjanser og avslutter de automatiske, men ikke prosentene som står på rutene i straffer og store sjanser, så de stemmer fortsatt. +1,0 er lite: ADR 0002 viser at fem poeng rating gir omtrent ett poeng i løpet av fem kamper.

**Billettluka er en samler, ikke en bank.** Når den er full, står den full, og tiden den ble stående er tapt. Klokka starter på nytt når du tømmer den. Det er mekanismen som gir en grunn til å komme tilbake, og det er også taket på hvor mye MB den kan gi: 12 MB i timen på nivå 10, men bare 96 MB per besøk, så tre besøk om dagen gir rundt 290 MB. Inntekten legges også i `manager_budget_earned`, som all annen inntekt.

## Ting vi ikke har bekreftet

- **Balansen er ikke simulert mot ekte tall.** Vi har ikke hatt tilgang til hvor mye MB som går inn og ut i produksjon. Prisene og inntektene (kostnad for nivå 10 på billettluka er 2500 MB og tjener inn 2 MB i timen ekstra) er satt konservativt, med vilje slik at stadionet er en langsiktig investering og ikke en snarvei til dyre pakker. De bør sjekkes mot ekte tall en uke eller to etter at det er rullet ut, og justeres i `stadium.ts` uten ny migrering, siden bare tallene endres.
- **Alle starter på samme tidspunkt.** Kolonnen `stadium_collected_at` får standardverdien `now()`, så ingen får opptjent inntekt fra før migreringen.
- **Nullstilling:** stadionet nullstilles ikke når managerkarrieren nullstilles.

## Ikke med i første versjon

- Flere byggere (kunne låses opp ved arenaopprykk).
- Flere bygninger: flomlys (kveldskamper), supporterfelt (kjemi i derbyer), treningsfelt.
- Å se vennens stadion.
- Hjemmebanebonus i draft og Femmer, som har egne kampoppsett.
- Å avbryte en oppgradering mot refusjon.
