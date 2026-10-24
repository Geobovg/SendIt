# Walkout-klipp

De beste kortene kan ha et eget videoklipp som spilles av i stedet for sprite-walkouten. Alle andre
walkouts bruker sprite-arket (`public/walkouts/sprite-walk.webp`, tegnet av `scripts/lag-walkout-sprite.py`):
en figur med lemmer går mot kameraet som en silhuett, lyses opp i et glimt og blir til spillerbildet.

## Slik legger du inn et klipp

1. Lag klippet med gjennomsiktig bakgrunn: spilleren går ut mot kameraet og slutter med feiringen sin.
   Anbefalt: 3:4 stående (f.eks. 720×960), 30 fps, 4–6 sekunder, ingen lyd, spilleren i full figur.
2. Legg filene i `public/walkouts/` med spillerens slug som navn (samme slug som bildet i `public/players`):
   - `<slug>.webm` (påkrevd, Chrome/Firefox/Android)
   - `<slug>.mov` (anbefalt, Safari/iOS)
3. Kjør `npm run walkout:klipp` (gjøres automatisk av `walkout:konverter`). Skriptet leser varigheten og oppdaterer `src/lib/walkout-clips.ts`.
4. Commit filene og den oppdaterte listen.

Mangler `.mov`, får Safari-brukere sprite-walkouten for den spilleren. Feiler klippet å lastes, faller
spilleren også tilbake til sprite-walkouten.

## Lage klippene med en AI-videomodell

Appen kan ikke lage videoene selv. Claude Code har ingen bilde- eller videomodell, og armer og bein
kan ikke rigges ut av et avskåret kortbilde uten at det blir strukket og revet. Klippene må lages i en
bilde-til-video-modell (f.eks. Runway, Kling, Veo, Luma eller Sora), og så gjør vi dem om til klipp med
gjennomsiktig bakgrunn:

1. Last opp kortbildet (`public/players/<slug>.webp`) som startbilde. Be om en **ensfarget grønn bakgrunn**
   (#00FF00), fast kamera, ingen skygger på bakken, 4–6 sekunder, spilleren i full figur.
2. Beskriv walkouten og feiringen, f.eks.: «The player walks confidently toward the camera against a
   plain bright green background, stops, and performs <feiring>. Static camera, full body, no cuts.»
3. Lagre videoen og kjør `npm run walkout:konverter -- kilde.mp4 <slug>`. Skriptet fjerner det grønne,
   skalerer til 3:4, skriver `public/walkouts/<slug>.webm` og oppdaterer listen over klipp.
   Er det grønne kantet eller halvgjennomsiktig, juster med `--likhet=` og `--blend=`.
4. For Safari må du i tillegg lage `<slug>.mov` på en Mac (se under).

Kjente signaturfeiringer å be om:

| Spiller | Feiring |
| --- | --- |
| Cristiano Ronaldo | Hopper, snurrer 180° i lufta og lander med armene ut og spreie bein (Siuuu) |
| Erling Haaland | Setter seg på bakken i lotusstilling med hendene på knærne og lukkede øyne (meditasjon) |
| Lionel Messi | Peker mot himmelen med begge pekefingrene og ser opp |
| Kylian Mbappé | Står med armene i kors og ser rolig rett fram |
| Mohamed Salah | Faller på kne og legger pannen mot bakken (sujood), eller åpner armene |
| Jude Bellingham | Åpner armene helt ut til sidene og står stille |
| Lamine Yamal | Dekker øynene med hendene, fingrene viser 3-0-4 |
| Antoine Griezmann | Danser «Hotline Bling» |
| Vinícius Júnior | Danser samba med små hopp |

Merk at klipp av ekte personer laget av en AI-modell kan komme i konflikt med modellens vilkår og med
spillernes rettigheter til eget bilde. Sjekk det før klippene publiseres utenfor en lukket vennegjeng.

## Koding

WebM med alfa (VP9):

    ffmpeg -i kilde.mov -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 32 -an <slug>.webm

MOV med alfa (HEVC), må kjøres på en Mac:

    ffmpeg -i kilde.mov -c:v hevc_videotoolbox -alpha_quality 0.75 -tag:v hvc1 -an <slug>.mov

Hold hvert klipp under ca. 2 MB. Alle klippene i pakka lastes ned mens pakka ryker opp.

## Hvilke spillere først

`scripts/walkout-klipp.mjs` har en liste over de 20 høyest rangerte kortene og sier fra om hvilke som
mangler klipp.
