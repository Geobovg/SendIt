import type { QuizText } from "../types";

// Flervalgsspørsmål. Svar og feilsvar er enten et navn (likt på alle språk) eller [norsk, engelsk].
// Spørsmålene skal handle om ting som ikke endrer seg (avsluttede turneringer, rekorder som står),
// så quizen ikke blir feil når en ny sesong er spilt.
type Answer = string | [string, string];
export type TriviaItem = { q: QuizText; a: Answer; wrong: [Answer, Answer, Answer]; fact?: QuizText };

const q = (no: string, en: string, a: Answer, wrong: [Answer, Answer, Answer], fact?: [string, string]): TriviaItem => ({
  q: { no, en },
  a,
  wrong,
  fact: fact && { no: fact[0], en: fact[1] },
});

const ARG: Answer = ["Argentina", "Argentina"];
const FRA: Answer = ["Frankrike", "France"];
const ESP: Answer = ["Spania", "Spain"];
const ENG: Answer = ["England", "England"];
const GER: Answer = ["Tyskland", "Germany"];
const ITA: Answer = ["Italia", "Italy"];
const BRA: Answer = ["Brasil", "Brazil"];
const NED: Answer = ["Nederland", "Netherlands"];
const POR: Answer = ["Portugal", "Portugal"];
const NOR: Answer = ["Norge", "Norway"];
const SWE: Answer = ["Sverige", "Sweden"];
const USA: Answer = ["USA", "USA"];
const URU: Answer = ["Uruguay", "Uruguay"];
const CRO: Answer = ["Kroatia", "Croatia"];

export const TRIVIA: TriviaItem[] = [
  // VM og EM
  q("Hvem vant VM i 2022?", "Who won the 2022 World Cup?", ARG, [FRA, CRO, ["Marokko", "Morocco"]], ["Argentina slo Frankrike på straffer etter 3–3 i finalen i Qatar.", "Argentina beat France on penalties after a 3–3 final in Qatar."]),
  q("Hvilket land arrangerte det første VM i 1930?", "Which country hosted the first World Cup in 1930?", URU, [BRA, ITA, ENG], ["Uruguay vant også turneringen.", "Uruguay won the tournament too."]),
  q("Hvem vant EM i 2024?", "Who won Euro 2024?", ESP, [ENG, FRA, NED], ["Spania slo England 2–1 i finalen i Berlin.", "Spain beat England 2–1 in the final in Berlin."]),
  q("Hvilket land vant EM i 2004 som en stor overraskelse?", "Which country shocked everyone by winning Euro 2004?", ["Hellas", "Greece"], [POR, ["Tsjekkia", "Czech Republic"], ["Danmark", "Denmark"]], ["Hellas slo vertsnasjonen Portugal 1–0 i finalen.", "Greece beat hosts Portugal 1–0 in the final."]),
  q("Danmark vant EM i 1992 etter å ha fått plassen til et annet land. Hvilket?", "Denmark won Euro 1992 after taking another country's place. Which one?", ["Jugoslavia", "Yugoslavia"], [["Sovjetunionen", "Soviet Union"], ["Tsjekkoslovakia", "Czechoslovakia"], SWE], ["Jugoslavia ble utestengt på grunn av krigen, og Danmark kom inn bare dager før start.", "Yugoslavia was banned because of the war, and Denmark got in just days before kick-off."]),
  q("Hvem scoret «Guds hånd»-målet i VM 1986?", "Who scored the 'Hand of God' goal at the 1986 World Cup?", "Diego Maradona", ["Pelé", "Zico", "Michel Platini"], ["Målet kom mot England i kvartfinalen, fire minutter før han scoret «århundrets mål».", "It came against England in the quarter-final, four minutes before his 'Goal of the Century'."]),
  q("Hva endte VM-semifinalen mellom Brasil og Tyskland i 2014?", "What was the score in the 2014 World Cup semi-final between Brazil and Germany?", "1–7", ["0–4", "2–5", "1–5"], ["Tyskland ledet 5–0 etter 29 minutter.", "Germany led 5–0 after 29 minutes."]),
  q("Hvem stanget Marco Materazzi i VM-finalen 2006?", "Who headbutted Marco Materazzi in the 2006 World Cup final?", "Zinédine Zidane", ["Thierry Henry", "Patrick Vieira", "Franck Ribéry"], ["Det var den siste kampen i Zidanes karriere.", "It was the last match of Zidane's career."]),
  q("Hvem vant VM i 2018?", "Who won the 2018 World Cup?", FRA, [CRO, ["Belgia", "Belgium"], ENG], ["Frankrike slo Kroatia 4–2 i finalen i Moskva.", "France beat Croatia 4–2 in the final in Moscow."]),
  q("Hvem scoret vinnermålet i VM-finalen 2010?", "Who scored the winner in the 2010 World Cup final?", "Andrés Iniesta", ["David Villa", "Xavi", "Fernando Torres"], ["Målet kom i det 116. minutt mot Nederland.", "It came in the 116th minute against the Netherlands."]),
  q("Hvem scoret vinnermålet i VM-finalen 2014?", "Who scored the winner in the 2014 World Cup final?", "Mario Götze", ["Thomas Müller", "André Schürrle", "Miroslav Klose"], ["Götze kom inn som innbytter og avgjorde mot Argentina i ekstraomgangene.", "Götze came off the bench and won it against Argentina in extra time."]),
  q("Hvilke land arrangerte VM i 2026?", "Which countries hosted the 2026 World Cup?", ["USA, Canada og Mexico", "USA, Canada and Mexico"], [["USA og Mexico", "USA and Mexico"], ["Spania, Portugal og Marokko", "Spain, Portugal and Morocco"], ["Brasil og Argentina", "Brazil and Argentina"]], ["Spania, Portugal og Marokko skal arrangere VM i 2030.", "Spain, Portugal and Morocco will host the 2030 World Cup."]),
  q("Hvor mange lag var med i VM-sluttspillet i 2026?", "How many teams played at the 2026 World Cup?", "48", ["32", "40", "64"], ["Det var første gang VM hadde mer enn 32 lag.", "It was the first World Cup with more than 32 teams."]),
  q("Norge slo Brasil i VM i 1998. Hva ble resultatet?", "Norway beat Brazil at the 1998 World Cup. What was the score?", "2–1", ["1–0", "3–2", "2–0"], ["Kjetil Rekdal avgjorde på straffe i Marseille.", "Kjetil Rekdal won it from the penalty spot in Marseille."]),
  q("Hvem var Norges landslagstrener i VM 1994 og 1998?", "Who managed Norway at the 1994 and 1998 World Cups?", "Egil «Drillo» Olsen", ["Nils Johan Semb", "Åge Hareide", "Per Mathias Høgmo"]),
  q("Hvilket år spilte Norges herrelandslag sitt første EM-sluttspill?", "In which year did Norway's men play their first European Championship finals?", "2000", ["1996", "2004", "1984"], ["Norge slo Spania 1–0 i åpningskampen i Rotterdam.", "Norway beat Spain 1–0 in their opening game in Rotterdam."]),
  q("Hvilket land vant VM på hjemmebane i 1966?", "Which country won the World Cup on home soil in 1966?", ENG, [GER, BRA, ITA], ["Geoff Hurst scoret hattrick i finalen mot Vest-Tyskland.", "Geoff Hurst scored a hat-trick in the final against West Germany."]),
  q("Hvilket land har vunnet flest EM for herrer?", "Which country has won the most men's European Championships?", ESP, [GER, ITA, FRA], ["Spania vant i 1964, 2008, 2012 og 2024.", "Spain won in 1964, 2008, 2012 and 2024."]),
  q("Hvilket land har vunnet Copa América flest ganger?", "Which country has won the Copa América the most times?", ARG, [URU, BRA, ["Chile", "Chile"]], ["Argentina tok sin 16. tittel i 2024, én mer enn Uruguay.", "Argentina won their 16th title in 2024, one more than Uruguay."]),
  q("Hvilket land har vunnet Afrikamesterskapet flest ganger?", "Which country has won the Africa Cup of Nations the most times?", ["Egypt", "Egypt"], [["Kamerun", "Cameroon"], ["Ghana", "Ghana"], ["Nigeria", "Nigeria"]]),
  q("Hvem ble kåret til beste spiller i VM 2022?", "Who was named best player at the 2022 World Cup?", "Lionel Messi", ["Kylian Mbappé", "Luka Modrić", "Enzo Fernández"], ["Messi vant også Gullballen i VM 2014.", "Messi also won the Golden Ball at the 2014 World Cup."]),
  q("Hvem vant OL-gull i fotball for menn i 2024?", "Who won men's Olympic football gold in 2024?", ESP, [FRA, ARG, BRA], ["Spania slo vertsnasjonen Frankrike 5–3 i finalen.", "Spain beat hosts France 5–3 in the final."]),
  q("Hva er kallenavnet til Brasils landslag?", "What is the nickname of Brazil's national team?", "Seleção", ["La Roja", "Les Bleus", "Oranje"]),
  q("Hva kalles Frankrikes landslag?", "What are France's national team called?", "Les Bleus", ["La Roja", "Azzurri", "Die Mannschaft"]),
  q("Hva kalles Italias landslag?", "What are Italy's national team called?", "Azzurri", ["Les Bleus", "Seleção", "La Albiceleste"]),
  q("Hvem er den mestscorende spilleren for et herrelandslag gjennom tidene?", "Who has scored the most goals for a men's national team?", "Cristiano Ronaldo", ["Ali Daei", "Lionel Messi", "Pelé"], ["Iranske Ali Daei hadde rekorden med 109 mål til Ronaldo tok den i 2021.", "Iran's Ali Daei held the record with 109 goals until Ronaldo took it in 2021."]),
  q("Hvem hadde rekorden for flest landslagsmål for Norge i nesten 90 år før Erling Haaland slo den?", "Who held Norway's goalscoring record for almost 90 years before Erling Haaland broke it?", "Jørgen Juve", ["Ole Gunnar Solskjær", "John Carew", "Tore André Flo"], ["Juve scoret 33 mål for Norge mellom 1928 og 1937.", "Juve scored 33 goals for Norway between 1928 and 1937."]),

  // Klubbfotball i Europa
  q("Hvilken klubb har vunnet Europacupen/Champions League flest ganger?", "Which club has won the European Cup/Champions League the most times?", "Real Madrid", ["AC Milan", "Bayern München", "Liverpool"], ["Real Madrid vant også de fem første utgavene, 1956–1960.", "Real Madrid also won the first five editions, 1956–1960."]),
  q("Hvem scoret vinnermålet for Manchester United i Champions League-finalen 1999?", "Who scored Manchester United's winner in the 1999 Champions League final?", "Ole Gunnar Solskjær", ["Teddy Sheringham", "Andy Cole", "Dwight Yorke"], ["United lå under 0–1 mot Bayern da tilleggstiden startet.", "United were 0–1 down to Bayern when stoppage time began."]),
  q("I «mirakelet i Istanbul» i 2005 hentet Liverpool inn 0–3 mot hvilket lag?", "In the 2005 'Miracle of Istanbul', Liverpool came back from 0–3 against which team?", "AC Milan", ["Juventus", "Inter", "Barcelona"], ["Liverpool vant på straffer etter 3–3.", "Liverpool won on penalties after 3–3."]),
  q("Hvem vant den første Champions League-sesongen i 1992–93?", "Who won the first Champions League season in 1992–93?", "Marseille", ["AC Milan", "Barcelona", "Ajax"], ["Marseille var den eneste franske vinneren helt til PSG vant i 2025.", "Marseille were the only French winners until PSG in 2025."]),
  q("Hvem vant Champions League i 2025?", "Who won the 2025 Champions League?", "Paris Saint-Germain", ["Inter", "Arsenal", "Barcelona"], ["PSG slo Inter 5–0 i finalen i München, den største seieren i en finale noensinne.", "PSG beat Inter 5–0 in Munich, the biggest winning margin in a final."]),
  q("Hvem slo Real Madrid i Champions League-finalen 2024?", "Who did Real Madrid beat in the 2024 Champions League final?", "Borussia Dortmund", ["Bayern München", "Manchester City", "Inter"], ["Finalen ble spilt på Wembley og endte 2–0.", "The final was played at Wembley and ended 2–0."]),
  q("Hvem vant Champions League i 2023?", "Who won the 2023 Champions League?", "Manchester City", ["Inter", "Real Madrid", "AC Milan"], ["Rodri scoret det eneste målet mot Inter i Istanbul.", "Rodri scored the only goal against Inter in Istanbul."]),
  q("Hvem er Champions Leagues toppscorer gjennom tidene?", "Who is the all-time top scorer in the Champions League?", "Cristiano Ronaldo", ["Lionel Messi", "Robert Lewandowski", "Karim Benzema"]),
  q("Hvilken norsk klubb spilte gruppespill i Champions League mange år på rad på 1990-tallet?", "Which Norwegian club played in the Champions League group stage for many years in a row in the 1990s?", "Rosenborg", ["Molde", "Brann", "Vålerenga"], ["Rosenborg slo blant annet Milan på San Siro i 1996.", "Rosenborg famously beat Milan at San Siro in 1996."]),
  q("Hvilken norsk klubb nådde semifinalen i Europa League i 2025?", "Which Norwegian club reached the Europa League semi-finals in 2025?", "Bodø/Glimt", ["Molde", "Rosenborg", "Brann"], ["Glimt ble slått ut av Tottenham, som vant hele turneringen.", "Glimt were knocked out by Tottenham, who went on to win it."]),
  q("Hvem vant Europa League i 2025?", "Who won the 2025 Europa League?", "Tottenham Hotspur", ["Manchester United", "Athletic Club", "Bodø/Glimt"], ["Tottenham slo Manchester United 1–0 i finalen i Bilbao.", "Tottenham beat Manchester United 1–0 in the final in Bilbao."]),
  q("Hvilken engelsk klubb vant Europacupen både i 1979 og 1980?", "Which English club won the European Cup in both 1979 and 1980?", "Nottingham Forest", ["Liverpool", "Aston Villa", "Leeds United"], ["Brian Clough var manager.", "Brian Clough was the manager."]),
  q("Bodø/Glimt slo et italiensk storlag 6–1 i Conference League i 2021. Hvilket?", "Bodø/Glimt beat an Italian giant 6–1 in the Conference League in 2021. Which one?", "Roma", ["Lazio", "Napoli", "Juventus"], ["Roma ble trent av José Mourinho.", "Roma were managed by José Mourinho."]),
  q("Hvem vant den nye utgaven av klubb-VM med 32 lag i 2025?", "Who won the new 32-team Club World Cup in 2025?", "Chelsea", ["Paris Saint-Germain", "Real Madrid", "Bayern München"], ["Chelsea slo PSG 3–0 i finalen i New Jersey.", "Chelsea beat PSG 3–0 in the final in New Jersey."]),
  q("Hvem trente Real Madrid da de vant Champions League tre år på rad (2016–2018)?", "Who managed Real Madrid when they won three Champions Leagues in a row (2016–2018)?", "Zinédine Zidane", ["Carlo Ancelotti", "José Mourinho", "Rafael Benítez"]),
  q("Hvilken klubb vant Bundesliga uten et eneste tap i 2023–24?", "Which club won the Bundesliga unbeaten in 2023–24?", "Bayer Leverkusen", ["Bayern München", "Borussia Dortmund", "RB Leipzig"], ["Det var Leverkusens første ligatittel noensinne.", "It was Leverkusen's first ever league title."]),
  q("Hvem trente Leverkusen da de vant Bundesliga ubeseiret?", "Who managed Leverkusen when they won the Bundesliga unbeaten?", "Xabi Alonso", ["Jürgen Klopp", "Julian Nagelsmann", "Thomas Tuchel"]),
  q("Hvilken klubb ble tvangsnedrykket til Serie B i 2006 etter Calciopoli-skandalen?", "Which club was relegated to Serie B in 2006 after the Calciopoli scandal?", "Juventus", ["AC Milan", "Lazio", "Fiorentina"]),
  q("Hvilken av disse klubbene har Pep Guardiola ikke trent?", "Which of these clubs has Pep Guardiola not managed?", "Juventus", ["Barcelona", "Bayern München", "Manchester City"]),
  q("Hvilken klubb trente Jürgen Klopp rett før han kom til Liverpool?", "Which club did Jürgen Klopp manage just before Liverpool?", "Borussia Dortmund", ["Mainz 05", "Bayern München", "Schalke 04"]),
  q("Hvilken trener kalte seg selv «The Special One»?", "Which manager called himself 'The Special One'?", "José Mourinho", ["Carlo Ancelotti", "Arsène Wenger", "Antonio Conte"]),
  q("Hvilken klubb solgte Neymar til PSG for rekordsummen 222 millioner euro i 2017?", "Which club sold Neymar to PSG for a record €222 million in 2017?", "Barcelona", ["Santos", "Real Madrid", "Chelsea"]),
  q("Hvilken klubb kjøpte Martin Ødegaard fra Strømsgodset i 2015?", "Which club signed Martin Ødegaard from Strømsgodset in 2015?", "Real Madrid", ["Barcelona", "Bayern München", "Ajax"], ["Ødegaard var bare 16 år.", "Ødegaard was only 16."]),
  q("Hvilken klubb var Diego Maradona en legende for i Italia?", "Which Italian club did Diego Maradona become a legend at?", "Napoli", ["Roma", "Juventus", "Inter"], ["Han ledet Napoli til de to første ligatitlene i klubbens historie.", "He led Napoli to the club's first two league titles."]),
  q("Hvilken klubb spilte Pelé for mesteparten av karrieren?", "Which club did Pelé play for during most of his career?", "Santos", ["Flamengo", "Corinthians", "Palmeiras"], ["Han avsluttet karrieren i New York Cosmos.", "He ended his career at New York Cosmos."]),
  q("Hvilken av disse klubbene har Erling Haaland ikke spilt for?", "Which of these clubs has Erling Haaland not played for?", "Ajax", ["Molde", "Red Bull Salzburg", "Borussia Dortmund"]),
  q("I hvilken klubb startet Erling Haaland seniorkarrieren?", "Where did Erling Haaland start his senior career?", "Bryne", ["Viking", "Molde", "Sandnes Ulf"]),
  q("Hvor er Erling Haaland født?", "Where was Erling Haaland born?", "Leeds", ["Bryne", "Stavanger", "Manchester"], ["Faren Alf-Inge spilte for Leeds United da Erling ble født.", "His father Alf-Inge was playing for Leeds United when Erling was born."]),

  // England
  q("Hvilket år startet Premier League?", "In which year did the Premier League start?", "1992", ["1888", "1990", "1995"]),
  q("Hvem vant Premier League sensasjonelt i 2015–16?", "Who sensationally won the Premier League in 2015–16?", "Leicester City", ["Tottenham Hotspur", "West Ham United", "Southampton"], ["Spillselskapene ga 5000 mot 1 på Leicester før sesongen.", "Bookmakers offered 5000/1 on Leicester before the season."]),
  q("Hvem vant Premier League i 2024–25?", "Who won the 2024–25 Premier League?", "Liverpool", ["Arsenal", "Manchester City", "Chelsea"], ["Det var Arne Slots første sesong som manager.", "It was Arne Slot's first season in charge."]),
  q("Hvilket lag gikk ubeseiret gjennom en hel Premier League-sesong i 2003–04?", "Which team went a whole Premier League season unbeaten in 2003–04?", "Arsenal", ["Chelsea", "Manchester United", "Liverpool"], ["Laget fikk kallenavnet «The Invincibles».", "The team became known as 'The Invincibles'."]),
  q("Hvem satte rekorden med 36 Premier League-mål i én sesong i 2022–23?", "Who set the record of 36 Premier League goals in a season in 2022–23?", "Erling Haaland", ["Mohamed Salah", "Harry Kane", "Alan Shearer"]),
  q("Hvem er Premier Leagues toppscorer gjennom tidene?", "Who is the Premier League's all-time top scorer?", "Alan Shearer", ["Harry Kane", "Wayne Rooney", "Thierry Henry"], ["Shearer scoret 260 mål.", "Shearer scored 260 goals."]),
  q("Hvem scoret målet som ga Manchester City ligatittelen på overtid i 2012?", "Who scored the stoppage-time goal that won Manchester City the 2012 title?", "Sergio Agüero", ["Edin Džeko", "Mario Balotelli", "David Silva"], ["Målet kom etter 93 minutter og 20 sekunder.", "It came after 93 minutes and 20 seconds."]),
  q("Hvem var manager for Manchester United fra 1986 til 2013?", "Who managed Manchester United from 1986 to 2013?", "Sir Alex Ferguson", ["Sir Matt Busby", "David Moyes", "Arsène Wenger"]),
  q("Hvilken klubb vant «trippelen» med liga, FA-cup og Champions League i 2022–23?", "Which club won the treble of league, FA Cup and Champions League in 2022–23?", "Manchester City", ["Arsenal", "Liverpool", "Manchester United"]),
  q("Hvilken klubb har kallenavnet «The Toffees»?", "Which club is nicknamed 'The Toffees'?", "Everton", ["Tottenham Hotspur", "West Ham United", "Burnley"]),
  q("Hvilken klubb har kallenavnet «The Magpies»?", "Which club is nicknamed 'The Magpies'?", "Newcastle United", ["Sunderland", "Fulham", "Brentford"]),
  q("Hvilken klubb har kallenavnet «The Hammers»?", "Which club is nicknamed 'The Hammers'?", "West Ham United", ["Arsenal", "Crystal Palace", "Aston Villa"]),
  q("Hvilken klubb har kallenavnet «Wolves»?", "Which club is nicknamed 'Wolves'?", "Wolverhampton Wanderers", ["Leeds United", "Southampton", "Brighton & Hove Albion"]),
  q("Hvem er Arsenals toppscorer gjennom tidene?", "Who is Arsenal's all-time top scorer?", "Thierry Henry", ["Ian Wright", "Robin van Persie", "Dennis Bergkamp"], ["Henry scoret 228 mål for klubben.", "Henry scored 228 goals for the club."]),
  q("Hvem er Manchester Uniteds toppscorer gjennom tidene?", "Who is Manchester United's all-time top scorer?", "Wayne Rooney", ["Bobby Charlton", "Cristiano Ronaldo", "Denis Law"], ["Rooney passerte Bobby Charlton i 2017 og endte på 253 mål.", "Rooney passed Bobby Charlton in 2017 and finished with 253 goals."]),

  // Stadioner og kallenavn
  q("Hvilken klubb spiller hjemmekampene på Anfield?", "Which club plays its home games at Anfield?", "Liverpool", ["Everton", "Manchester United", "Leeds United"]),
  q("Hvilken klubb spiller på Signal Iduna Park?", "Which club plays at Signal Iduna Park?", "Borussia Dortmund", ["Bayern München", "Schalke 04", "Bayer Leverkusen"], ["Den gule veggen på sørtribunen har plass til rundt 25 000.", "The Yellow Wall on the south stand holds about 25,000."]),
  q("Hvilken klubb spiller på Santiago Bernabéu?", "Which club plays at the Santiago Bernabéu?", "Real Madrid", ["Atlético Madrid", "Barcelona", "Sevilla"]),
  q("Hvilke klubber deler San Siro?", "Which clubs share San Siro?", ["AC Milan og Inter", "AC Milan and Inter"], [["Roma og Lazio", "Roma and Lazio"], ["Juventus og Torino", "Juventus and Torino"], ["Genoa og Sampdoria", "Genoa and Sampdoria"]]),
  q("Hvilken klubb spiller på Parc des Princes?", "Which club plays at the Parc des Princes?", "Paris Saint-Germain", ["Marseille", "Paris FC", "Lyon"]),
  q("Hvilken klubb spiller på Lerkendal?", "Which club plays at Lerkendal?", "Rosenborg", ["Molde", "Brann", "Bodø/Glimt"]),
  q("Hvilken klubb spiller på Aspmyra?", "Which club plays at Aspmyra?", "Bodø/Glimt", ["Tromsø", "Rosenborg", "Molde"]),
  q("Hvilken klubb spiller på La Bombonera?", "Which club plays at La Bombonera?", "Boca Juniors", ["River Plate", "Racing Club", "Independiente"]),
  q("Hvilke lag møtes i «Old Firm»-derbyet?", "Which teams meet in the 'Old Firm' derby?", ["Celtic og Rangers", "Celtic and Rangers"], [["Liverpool og Everton", "Liverpool and Everton"], ["Hearts og Hibernian", "Hearts and Hibernian"], ["Arsenal og Tottenham", "Arsenal and Tottenham"]]),
  q("Hvilke lag møtes i «Superclásico» i Argentina?", "Which teams meet in Argentina's 'Superclásico'?", ["Boca Juniors og River Plate", "Boca Juniors and River Plate"], [["Racing og Independiente", "Racing and Independiente"], ["Rosario Central og Newell's", "Rosario Central and Newell's"], ["Boca Juniors og Racing", "Boca Juniors and Racing"]]),
  q("Hvilken klubb kalles «La Vecchia Signora» – den gamle damen?", "Which club is called 'La Vecchia Signora' – the Old Lady?", "Juventus", ["AC Milan", "Roma", "Torino"]),
  q("Hvilken klubb kalles «Los Colchoneros»?", "Which club is called 'Los Colchoneros'?", "Atlético Madrid", ["Real Madrid", "Valencia", "Real Betis"]),
  q("Hvilken klubb kalles «Die Werkself»?", "Which club is called 'Die Werkself'?", "Bayer Leverkusen", ["Wolfsburg", "RB Leipzig", "Schalke 04"]),

  // Legender og priser
  q("Hvor mange Ballon d'Or-priser har Lionel Messi vunnet?", "How many Ballon d'Or awards has Lionel Messi won?", "8", ["6", "7", "5"]),
  q("Hvem vant Ballon d'Or i 2025?", "Who won the 2025 Ballon d'Or?", "Ousmane Dembélé", ["Lamine Yamal", "Vitinha", "Mohamed Salah"]),
  q("Hvem vant Ballon d'Or i 2024?", "Who won the 2024 Ballon d'Or?", "Rodri", ["Vinícius Júnior", "Jude Bellingham", "Dani Carvajal"]),
  q("Hvem er den eneste keeperen som har vunnet Ballon d'Or?", "Who is the only goalkeeper to have won the Ballon d'Or?", "Lev Jashin", ["Gianluigi Buffon", "Manuel Neuer", "Iker Casillas"], ["Den sovjetiske keeperen vant i 1963.", "The Soviet goalkeeper won in 1963."]),
  q("Hvor mange VM-titler vant Pelé?", "How many World Cups did Pelé win?", "3", ["2", "4", "1"], ["Han vant i 1958, 1962 og 1970.", "He won in 1958, 1962 and 1970."]),
  q("Hvilken legende fikk kallenavnet «Keiseren»?", "Which legend was nicknamed 'Der Kaiser'?", "Franz Beckenbauer", ["Gerd Müller", "Lothar Matthäus", "Karl-Heinz Rummenigge"]),
  q("Hvilket land kom Johan Cruyff fra?", "Which country was Johan Cruyff from?", NED, [["Belgia", "Belgium"], GER, ["Danmark", "Denmark"]]),
  q("Hvilken norsk spiller vant den første Ballon d'Or for kvinner i 2018?", "Which Norwegian won the first women's Ballon d'Or in 2018?", "Ada Hegerberg", ["Caroline Graham Hansen", "Guro Reiten", "Maren Mjelde"]),
  q("Hvilken spiller var verdens dyreste i 2016 da han gikk til Manchester United for 105 millioner euro?", "Who became the world's most expensive player in 2016 when he joined Manchester United for €105 million?", "Paul Pogba", ["Gareth Bale", "Cristiano Ronaldo", "Ángel Di María"]),

  // Kvinnefotball
  q("Hvem vant kvinne-VM i 2023?", "Who won the 2023 Women's World Cup?", ESP, [ENG, SWE, USA]),
  q("Hvilket år vant Norge kvinne-VM?", "In which year did Norway win the Women's World Cup?", "1995", ["1991", "1999", "2003"], ["Norge slo Tyskland 2–0 i finalen i Stockholm.", "Norway beat Germany 2–0 in the final in Stockholm."]),
  q("Hvem vant det første kvinne-VM i 1991?", "Who won the first Women's World Cup in 1991?", USA, [NOR, ["Kina", "China"], GER], ["USA slo Norge 2–1 i finalen.", "The USA beat Norway 2–1 in the final."]),
  q("Hvem vant kvinne-EM i 2025?", "Who won Women's Euro 2025?", ENG, [ESP, GER, FRA], ["England slo Spania på straffer i finalen i Basel.", "England beat Spain on penalties in the final in Basel."]),

  // Norsk fotball
  q("Hvilken klubb har vunnet flest norske seriemesterskap for herrer?", "Which club has won the most Norwegian men's league titles?", "Rosenborg", ["Fredrikstad", "Viking", "Molde"]),
  q("Hvilken klubb vant Eliteserien for første gang i 2020?", "Which club won Eliteserien for the first time in 2020?", "Bodø/Glimt", ["Molde", "Brann", "Lillestrøm"]),
  q("Hva heter nasjonalarenaen for fotball i Oslo?", "What is the name of the national football stadium in Oslo?", "Ullevaal stadion", ["Bislett stadion", "Intility Arena", "Lerkendal"]),
  q("Hvilken klubb spilte Ole Gunnar Solskjær for før han gikk til Manchester United?", "Which club did Ole Gunnar Solskjær play for before joining Manchester United?", "Molde", ["Rosenborg", "Brann", "Lillestrøm"]),

  // Regler
  q("Hvor langt fra mållinjen er straffemerket?", "How far from the goal line is the penalty spot?", "11 m", ["9 m", "12 m", "16,5 m"]),
  q("Hvor bredt er et fotballmål?", "How wide is a football goal?", "7,32 m", ["7,00 m", "8,00 m", "6,50 m"], ["Det tilsvarer 8 yards.", "That is 8 yards."]),
  q("Hvor høyt er et fotballmål?", "How high is a football goal?", "2,44 m", ["2,20 m", "2,50 m", "2,00 m"], ["Det tilsvarer 8 fot.", "That is 8 feet."]),
  q("Hvor langt unna må motspillerne stå ved et frispark?", "How far away must opponents stand at a free kick?", "9,15 m", ["5 m", "7,32 m", "11 m"], ["Det er 10 yards.", "That is 10 yards."]),
  q("Hvor mange bytter kan et lag gjøre i en ordinær kamp etter dagens regler?", "How many substitutions can a team make in a normal match under today's rules?", "5", ["3", "4", "6"], ["Regelen ble fast i 2022, etter at den først var innført under pandemien.", "The rule became permanent in 2022 after first being introduced during the pandemic."]),
  q("Hvor mange spillere må et lag minst ha på banen for at kampen kan fortsette?", "What is the minimum number of players a team needs for a match to continue?", "7", ["8", "6", "9"]),
  q("Hva betyr et rødt kort?", "What does a red card mean?", ["Utvisning", "Sending off"], [["Advarsel", "Caution"], ["Straffespark", "Penalty kick"], ["Indirekte frispark", "Indirect free kick"]]),
  q("Hvilket VM var det første med gule og røde kort?", "Which World Cup was the first with yellow and red cards?", "1970", ["1966", "1974", "1958"]),
];
