# FotMob-skript

FotMob har ikke noe åpent API, så skriptene leser dataene som ligger i selve sidene (`__NEXT_DATA__`). Alt caches i `data/cache`
(git-ignorert), og det er pause mellom kallene. `images.fotmob.com` og `/api/*` virker ikke herfra.

Rekkefølge fra scratch:

| Skript | Hva det gjør | Skriver |
|---|---|---|
| `bygg-katalog.mjs` | Leser katalogen ut av migreringene | `data/katalog.json` |
| `hent-ligaer.mjs` | Ligasider → alle lag | `data/lag.json` |
| `koble-klubber.mjs` | Katalogklubb → FotMob-lag | `data/klubber.json` |
| `hent-tropper.mjs [alle]` | Lagsider → tropper | `data/tropper.json` |
| `match.mjs` | Katalogspiller → FotMob-ID (`data/manuelle.json` for rettelser) | `data/match.json` |
| `hent-profiler.mjs` | Spillerprofiler (ca. 1 time) | `data/profiler.json` |

Det de brukes til:

| Skript | Resultat |
|---|---|
| `synk-form.mjs [--skriv]` | Kampkarakterer siste uke → `fotmob_form` (0118). Kjøres av `.github/workflows/fotmob-form.yml` fredag ettermiddag |
| `klubb-migrering.mjs <nr>` | Klubb og liga fra FotMob → migrering + `data/klubbrapport.md` |
| `egenskaper.mjs [<nr>]` | Egenskaper fra sesongstatistikk → migrering |
| `alt-posisjoner.mjs [<nr>]` | Alternative posisjoner (samme regler som 0112) → migrering |
| `prisforslag.mjs` | Prisforslag for de 100 beste → `data/prisforslag.md` |

Migreringene kan testes mot en lokal Postgres ved å kjøre hele kjeden (med stubber for `auth`, `storage` og `pg_cron`).
