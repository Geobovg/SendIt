# Brukerlag som motstandere i AI-sesongen

AI-sesongen bruker nå de andre brukernes lag som motstandere i stedet for oppdiktede klubber. Alle brukere med en gyldig ellever kan bli valgt, ikke bare venner i appen, fordi brukerne kjenner hverandre uansett. Dette endrer ikke beslutningen i 0001: tabellen har fortsatt nøyaktig fem motstandere, og opprykk er definert som før. Motstanderne spiller ikke selv. Laget deres brukes som en AI-klubb, og de får ingen premie, kamphistorikk eller kamp som teller mot dagsgrensen.

Vanskelighetsgraden er den samme som før. Hver klubb i `teams` får ratingen fra arena og divisjon (0062), og når kampen starter, flyttes alle spillerne like mye slik at snittet av de elleve som starter blir den ratingen (`userTeamAsOpponent`). Lagene plukkes fra en rangering av alle brukerlag, slik at lave nivåer møter de svakeste lagene og de høyeste nivåene de beste. Vi vurderte å bruke lagenes ekte styrke, men da ville vanskelighetsgraden avhenge av hvem som tilfeldigvis er med, ikke av divisjonen. Er det for få brukere, fylles resten med AI-klubber. Det samme skjer i en kamp der brukerlaget ikke lenger har en gyldig ellever.

Sesongene som var i gang da dette ble innført, fikk brukerlag med en gang (0091). Bare navnet og eieren til hver klubb ble byttet. Nøkkel, rating og bonus sto, så tabellen og poengene ble de samme. Kamper som allerede var spilt, viser fortsatt navnet på AI-klubben.

Lagene i sesongen heter det brukeren heter, også ditt eget, ikke klubbnavnet. De fleste har standardnavnet «My team», så klubbnavnet skilte ikke lagene fra hverandre (0092).
