import type { QuizText } from "../types";

// «Sant eller usant». Påstandene skal være like sanne om ti år.
export type Statement = { s: QuizText; true: boolean; fact?: QuizText };

const s = (no: string, en: string, isTrue: boolean, fact?: [string, string]): Statement => ({
  s: { no, en },
  true: isTrue,
  fact: fact && { no: fact[0], en: fact[1] },
});

export const STATEMENTS: Statement[] = [
  // Regler
  s("Man kan score direkte fra avspark.", "You can score directly from a kick-off.", true, ["Det har vært lov siden 1997.", "It has been allowed since 1997."]),
  s("Man kan ikke være offside rett fra et innkast.", "You cannot be offside directly from a throw-in.", true),
  s("Man kan være offside på egen banehalvdel.", "You can be offside in your own half.", false),
  s("Et mål kan scores direkte fra et innkast.", "A goal can be scored directly from a throw-in.", false),
  s("Keeperen kan ta ballen med hendene når en medspiller sender den bevisst tilbake med foten.", "The goalkeeper may handle the ball when a teammate deliberately kicks it back to them.", false, ["Tilbakespillsregelen kom i 1992.", "The back-pass rule arrived in 1992."]),
  s("Hele ballen må være over mållinjen for at det skal være mål.", "The whole ball must cross the goal line for a goal.", true),
  s("Man kan ikke være offside rett fra et cornerspark.", "You cannot be offside directly from a corner kick.", true),
  s("En ordinær kamp består av to omganger på 45 minutter.", "A normal match has two halves of 45 minutes.", true),
  s("Den første straffesparkkonkurransen i et VM var i 1982.", "The first penalty shoot-out at a World Cup was in 1982.", true, ["Vest-Tyskland slo Frankrike i semifinalen i Sevilla.", "West Germany beat France in the semi-final in Seville."]),
  s("VAR ble brukt i et VM for første gang i 2018.", "VAR was first used at a World Cup in 2018.", true),

  // VM og landslag
  s("Det første VM ble spilt i 1934.", "The first World Cup was played in 1934.", false, ["Det første VM var i Uruguay i 1930.", "The first World Cup was in Uruguay in 1930."]),
  s("Brasil har spilt i alle VM-sluttspill.", "Brazil have played at every World Cup.", true),
  s("Italia var ikke med i VM verken i 2018 eller 2022.", "Italy missed both the 2018 and 2022 World Cups.", true),
  s("Lionel Messi har vunnet VM.", "Lionel Messi has won the World Cup.", true, ["Argentina vant i Qatar i 2022.", "Argentina won in Qatar in 2022."]),
  s("Cristiano Ronaldo har vunnet VM.", "Cristiano Ronaldo has won the World Cup.", false, ["Men han vant EM med Portugal i 2016.", "But he won the Euros with Portugal in 2016."]),
  s("Danmark vant EM i 1992.", "Denmark won Euro 1992.", true),
  s("Hellas vant EM i 2004.", "Greece won Euro 2004.", true),
  s("Norges herrelandslag slo Brasil i VM i 1998.", "Norway's men beat Brazil at the 1998 World Cup.", true),
  s("Norge har vunnet VM for kvinner.", "Norway have won the Women's World Cup.", true, ["Norge vant i Sverige i 1995.", "Norway won in Sweden in 1995."]),
  s("Norge har vunnet OL-gull i fotball for kvinner.", "Norway have won Olympic gold in women's football.", true, ["Norge slo USA i finalen i Sydney i 2000.", "Norway beat the USA in the final in Sydney in 2000."]),
  s("Tyskland slo Brasil 7–1 i VM-semifinalen i 2014.", "Germany beat Brazil 7–1 in the 2014 World Cup semi-final.", true),
  s("Zinédine Zidane fikk rødt kort i VM-finalen 2006.", "Zinédine Zidane was sent off in the 2006 World Cup final.", true),
  s("Iker Casillas har vunnet VM.", "Iker Casillas has won the World Cup.", true, ["Han var kaptein da Spania vant i 2010.", "He captained Spain to the 2010 title."]),
  s("Fotball var ikke på programmet i OL i Los Angeles i 1932.", "Football was not part of the 1932 Olympics in Los Angeles.", true),

  // Klubber
  s("Real Madrid ble stiftet før Barcelona.", "Real Madrid were founded before Barcelona.", false, ["Barcelona ble stiftet i 1899, Real Madrid i 1902.", "Barcelona were founded in 1899, Real Madrid in 1902."]),
  s("Leicester City var 5000 mot 1-outsider før de vant Premier League i 2016.", "Leicester City were 5000/1 outsiders before winning the 2016 Premier League.", true),
  s("Ole Gunnar Solskjær scoret vinnermålet i Champions League-finalen 1999.", "Ole Gunnar Solskjær scored the winner in the 1999 Champions League final.", true),
  s("Bayern München har aldri rykket ned fra Bundesliga.", "Bayern Munich have never been relegated from the Bundesliga.", true),
  s("Hamburger SV har aldri rykket ned fra Bundesliga.", "Hamburger SV have never been relegated from the Bundesliga.", false, ["HSV rykket ned for første gang i 2018.", "HSV went down for the first time in 2018."]),
  s("Juventus ble tvangsnedrykket til Serie B i 2006.", "Juventus were relegated to Serie B in 2006.", true),
  s("Paris Saint-Germain vant sin første Champions League i 2025.", "Paris Saint-Germain won their first Champions League in 2025.", true),
  s("Chelsea har vunnet Champions League.", "Chelsea have won the Champions League.", true, ["Chelsea vant i 2012 og 2021.", "Chelsea won in 2012 and 2021."]),
  s("Manchester City vant trippelen i 2022–23.", "Manchester City won the treble in 2022–23.", true),
  s("Tottenham vant Europa League i 2025.", "Tottenham won the Europa League in 2025.", true),
  s("Bodø/Glimt slo Roma 6–1 i 2021.", "Bodø/Glimt beat Roma 6–1 in 2021.", true),
  s("Rosenborg har spilt gruppespill i Champions League.", "Rosenborg have played in the Champions League group stage.", true),
  s("Arsenal gikk ubeseiret gjennom Premier League-sesongen 2003–04.", "Arsenal went unbeaten through the 2003–04 Premier League season.", true),

  // Spillere
  s("Zlatan Ibrahimović vant Champions League.", "Zlatan Ibrahimović won the Champions League.", false),
  s("Gianluigi Buffon vant aldri Champions League.", "Gianluigi Buffon never won the Champions League.", true, ["Han tapte tre finaler med Juventus.", "He lost three finals with Juventus."]),
  s("Diego Maradona spilte for Barcelona.", "Diego Maradona played for Barcelona.", true, ["Han spilte der fra 1982 til 1984 før han gikk til Napoli.", "He played there from 1982 to 1984 before joining Napoli."]),
  s("Ronaldinho spilte for Paris Saint-Germain.", "Ronaldinho played for Paris Saint-Germain.", true),
  s("Pelé spilte for en klubb i Europa.", "Pelé played for a European club.", false, ["Han spilte bare for Santos og New York Cosmos.", "He only played for Santos and New York Cosmos."]),
  s("Erling Haaland er født i Norge.", "Erling Haaland was born in Norway.", false, ["Han ble født i Leeds i 2000.", "He was born in Leeds in 2000."]),
  s("Lionel Messi har spilt for Manchester City.", "Lionel Messi has played for Manchester City.", false),
  s("Thierry Henry er Arsenals toppscorer gjennom tidene.", "Thierry Henry is Arsenal's all-time top scorer.", true),
  s("Wayne Rooney er Manchester Uniteds toppscorer gjennom tidene.", "Wayne Rooney is Manchester United's all-time top scorer.", true),
  s("Lev Jashin var keeper.", "Lev Yashin was a goalkeeper.", true),
  s("Johan Cruyff både spilte for og trente Barcelona.", "Johan Cruyff both played for and managed Barcelona.", true),
  s("Kaká vant Ballon d'Or.", "Kaká won the Ballon d'Or.", true, ["Han vant i 2007, som den siste før Messi og Ronaldo tok over.", "He won in 2007, the last winner before Messi and Ronaldo took over."]),
  s("Steven Gerrard vant Premier League som spiller.", "Steven Gerrard won the Premier League as a player.", false),
  s("Andrea Pirlo har vunnet VM.", "Andrea Pirlo has won the World Cup.", true, ["Italia vant i 2006.", "Italy won in 2006."]),
];
