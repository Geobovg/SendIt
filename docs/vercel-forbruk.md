# Forbruk hos Vercel

Appen kjører på gratisplanen (Hobby) hos Vercel. Går forbruket over grensene, settes hele siden på pause, og nye deployments blir blokkert til Vercel låser opp kontoen manuelt. Det skjedde 12. oktober 2026.

| Hva | Grense per måned | Omtrent per døgn |
| --- | --- | --- |
| Fluid Active CPU | 4 t | 8 min |
| Funksjonskall | 1 mill. | 33 000 |
| CDN-forespørsler | 1 mill. | 33 000 |
| Bildeoptimalisering | 5 000 | – (slått av, se `next.config.ts`) |

## Hva som brukte opp kvoten

Nesten hver forespørsel var et funksjonskall: sider som hentet seg selv på nytt fra serveren hvert 0,8–3 sekund (kampsiden, turneringssidene og markedschatten), en Fantasy-jobb hvert andre minutt og brukere som lot ChatGPT spille kamp etter kamp. Se PR #126, #127 og #128.

## Tommelfingerregler

- Hver `router.refresh()` og hver server action er et funksjonskall som lager hele siden på nytt. Ikke oppdater oftere enn hvert 10. sekund uten en god grunn, og aldri i en skjult fane.
- Følg tett bare når noe faktisk kan endre seg, som under en sjanse eller i byttevinduet i managerkampen.
- Nye jobber som kaller appen fra pg_cron, koster et funksjonskall hver gang. Gjør det i databasen hvis det går.
- Ting som kan gjentas uten stopp (kamper, pakker o.l.), bør ha et tak per bruker, som `PERIOD_MATCHES` i `src/lib/match-limit.ts`.
