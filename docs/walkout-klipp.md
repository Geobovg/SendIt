# Walkout-klipp

De beste kortene kan ha et eget videoklipp som spilles av i stedet for sprite-walkouten. Alle andre
walkouts bruker sprite-arket (`public/walkouts/sprite-walk.png`, tegnet av `scripts/lag-walkout-sprite.py`):
en figur med lemmer går mot kameraet som en silhuett, lyses opp i et glimt og blir til spillerbildet.

## Slik legger du inn et klipp

1. Lag klippet med gjennomsiktig bakgrunn: spilleren går ut mot kameraet og slutter med feiringen sin.
   Anbefalt: 3:4 stående (f.eks. 720×960), 30 fps, 4–6 sekunder, ingen lyd, spilleren i full figur.
2. Legg filene i `public/walkouts/` med spillerens slug som navn (samme slug som bildet i `public/players`):
   - `<slug>.webm` (påkrevd, Chrome/Firefox/Android)
   - `<slug>.mov` (anbefalt, Safari/iOS)
3. Kjør `npm run walkout:klipp`. Skriptet leser varigheten og oppdaterer `src/lib/walkout-clips.ts`.
4. Commit filene og den oppdaterte listen.

Mangler `.mov`, får Safari-brukere sprite-walkouten for den spilleren. Feiler klippet å lastes, faller
spilleren også tilbake til sprite-walkouten.

## Koding

WebM med alfa (VP9):

    ffmpeg -i kilde.mov -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 32 -an <slug>.webm

MOV med alfa (HEVC), må kjøres på en Mac:

    ffmpeg -i kilde.mov -c:v hevc_videotoolbox -alpha_quality 0.75 -tag:v hvc1 -an <slug>.mov

Hold hvert klipp under ca. 2 MB. Alle klippene i pakka lastes ned mens pakka ryker opp.

## Hvilke spillere først

`scripts/walkout-klipp.mjs` har en liste over de 20 høyest rangerte kortene og sier fra om hvilke som
mangler klipp.
