// Henter ligasidene fra FotMob og samler alle lag (id + navn + liga) i data/lag.json.
// Bruk: node scripts/fotmob/hent-ligaer.mjs
import { writeFileSync } from "node:fs";
import { hentSide } from "./fotmob.mjs";

// Ligaene klubbene i katalogen spiller i (FotMob-ID-er)
const ligaer = {
  47: "Premier League", 48: "Championship", 87: "LaLiga", 140: "LaLiga 2", 54: "Bundesliga", 146: "2. Bundesliga",
  55: "Serie A", 86: "Serie B", 53: "Ligue 1", 110: "Ligue 2", 57: "Eredivisie", 61: "Liga Portugal", 71: "Super Lig",
  536: "Saudi Pro League", 130: "MLS", 40: "Pro League", 135: "Super League Greece", 112: "Liga Profesional", 268: "Brasileirão",
  59: "Eliteserien", 64: "Premiership", 69: "Super League Switzerland", 38: "Bundesliga Austria", 63: "Premier League Russia",
  9: "Qatar Stars League", 119: "Czech Liga", 230: "Liga MX", 274: "Liga BetPlay", 223: "J1 League", 126: "SuperLiga Serbia", 267: "Eerste Divisie",
};

const lag = new Map();
for (const [id, navn] of Object.entries(ligaer)) {
  try {
    const { sideData: side, fraCache } = await hentSide(`/leagues/${id}/overview/x`, `liga-${id}`);
    const rader = (side.table ?? []).flatMap((t) => t.data?.table?.all ?? t.data?.tables?.flatMap((x) => x.table?.all ?? []) ?? []);
    for (const r of rader) lag.set(r.id, { id: r.id, name: r.name, shortName: r.shortName, league: navn, leagueId: Number(id) });
    console.log(`${fraCache ? "(cache) " : ""}${navn}: ${rader.length} lag`);
  } catch (e) {
    console.log(`${navn}: FEIL ${e.message}`);
  }
}
writeFileSync(new URL("./data/lag.json", import.meta.url), JSON.stringify([...lag.values()], null, 1));
console.log(`${lag.size} lag totalt`);
