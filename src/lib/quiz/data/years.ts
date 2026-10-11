import type { QuizText } from "../types";

// «Hvilket år?». Feilsvarene lages av motoren, nær det riktige året.
export type YearItem = { q: QuizText; year: number };

const y = (no: string, en: string, year: number): YearItem => ({ q: { no, en }, year });

export const YEARS: YearItem[] = [
  y("Hvilket år ble det første VM spilt?", "When was the first World Cup played?", 1930),
  y("Hvilket år startet Premier League?", "When did the Premier League start?", 1992),
  y("Hvilket år vant Leicester City Premier League?", "When did Leicester City win the Premier League?", 2016),
  y("Hvilket år var «mirakelet i Istanbul»?", "When was the 'Miracle of Istanbul'?", 2005),
  y("Hvilket år scoret Solskjær vinnermålet i Champions League-finalen?", "When did Solskjær score the winner in the Champions League final?", 1999),
  y("Hvilket år slo Norge Brasil i VM?", "When did Norway beat Brazil at the World Cup?", 1998),
  y("Hvilket år vant Danmark EM?", "When did Denmark win the Euros?", 1992),
  y("Hvilket år vant Hellas EM?", "When did Greece win the Euros?", 2004),
  y("Hvilket år scoret Maradona «Guds hånd»-målet?", "When did Maradona score the 'Hand of God' goal?", 1986),
  y("Hvilket år tapte Brasil 1–7 for Tyskland?", "When did Brazil lose 1–7 to Germany?", 2014),
  y("Hvilket år stanget Zidane Materazzi i VM-finalen?", "When did Zidane headbutt Materazzi in the World Cup final?", 2006),
  y("Hvilket år kom Bosman-dommen?", "When was the Bosman ruling?", 1995),
  y("Hvilket år scoret Agüero 93:20-målet for Manchester City?", "When did Agüero score the 93:20 goal for Manchester City?", 2012),
  y("Hvilket år vant Messi VM?", "When did Messi win the World Cup?", 2022),
  y("Hvilket år vant England VM?", "When did England win the World Cup?", 1966),
  y("Hvilket år vant Norge kvinne-VM?", "When did Norway win the Women's World Cup?", 1995),
  y("Hvilket år tok Norges kvinner OL-gull i fotball?", "When did Norway's women win Olympic football gold?", 2000),
  y("Hvilket år vant Bodø/Glimt sitt første seriegull?", "When did Bodø/Glimt win their first league title?", 2020),
  y("Hvilket år gikk Neymar til PSG for 222 millioner euro?", "When did Neymar join PSG for €222 million?", 2017),
  y("Hvilket år ble Real Madrid stiftet?", "When were Real Madrid founded?", 1902),
  y("Hvilket år ble Barcelona stiftet?", "When were Barcelona founded?", 1899),
  y("Hvilket år ble FIFA stiftet?", "When was FIFA founded?", 1904),
  y("Hvilket år ble UEFA stiftet?", "When was UEFA founded?", 1954),
  y("Hvilket år ble det første EM for herrer spilt?", "When was the first men's European Championship played?", 1960),
  y("Hvilket år gikk Cristiano Ronaldo fra Manchester United til Real Madrid?", "When did Cristiano Ronaldo move from Manchester United to Real Madrid?", 2009),
  y("Hvilket år forlot Messi Barcelona for PSG?", "When did Messi leave Barcelona for PSG?", 2021),
  y("Hvilket år kom Erling Haaland til Manchester City?", "When did Erling Haaland join Manchester City?", 2022),
  y("Hvilket år ble det første kvinne-VM spilt?", "When was the first Women's World Cup played?", 1991),
  y("Hvilket år ble Juventus tvangsnedrykket etter Calciopoli?", "When were Juventus relegated after Calciopoli?", 2006),
  y("Hvilket år ble Ballon d'Or delt ut for første gang?", "When was the Ballon d'Or first awarded?", 1956),
  y("Hvilket år var Arsenals ubeseirede sesong ferdig?", "In which year did Arsenal complete their unbeaten season?", 2004),
  y("Hvilket år vant Leverkusen Bundesliga uten tap?", "When did Leverkusen win the Bundesliga unbeaten?", 2024),
  y("Hvilket år vant PSG sin første Champions League?", "When did PSG win their first Champions League?", 2025),
  y("Hvilket år spilte Norges herrer sitt første EM-sluttspill?", "When did Norway's men play their first European Championship finals?", 2000),
  y("Hvilket år ble VAR brukt i VM for første gang?", "When was VAR first used at a World Cup?", 2018),
  y("Hvilket år slo Bodø/Glimt Roma 6–1?", "When did Bodø/Glimt beat Roma 6–1?", 2021),
  y("Hvilket år vant Spania VM?", "When did Spain win the World Cup?", 2010),
  y("Hvilket år vant Frankrike sitt første VM?", "When did France win their first World Cup?", 1998),
  y("Hvilket år ble Martin Ødegaard solgt til Real Madrid?", "When was Martin Ødegaard sold to Real Madrid?", 2015),
];
