// Lager klubbendringene (og riktig liga) fra FotMob som en migrering, pluss en rapport til kontroll.
// Bruk: node scripts/fotmob/klubb-migrering.mjs <migreringsnummer>   (f.eks. 0118)
// Skriver supabase/migrations/<nr>_klubber_fra_fotmob.sql og data/klubbrapport.md
import { readFileSync, writeFileSync } from "node:fs";
import { normaliser } from "./fotmob.mjs";

const nr = process.argv[2];
if (!/^\d{4}$/.test(nr ?? "")) throw new Error("Oppgi migreringsnummer, f.eks. 0118");
const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const katalog = new Map(les("katalog.json").map((s) => [s.slug, s]));
const match = les("match.json");
const tropper = new Map();
for (const p of les("tropper.json")) if (!tropper.has(p.id)) tropper.set(p.id, p);
const lag = new Map(les("lag.json").map((t) => [t.id, t]));
const klubber = les("klubber.json"); // katalogklubb -> FotMob-lag-id

// Ligakodene i player_catalog.league (0045/0046). Andre ligaer er 'other'.
const ligaKode = { 47: "premier_league", 87: "la_liga", 55: "serie_a", 54: "bundesliga", 53: "ligue_1", 57: "eredivisie", 61: "primeira_liga", 71: "super_lig", 536: "saudi_pro_league" };
const ligaAv = (teamId) => ligaKode[lag.get(teamId)?.leagueId] ?? "other";

// Lag-id -> klubbnavn slik katalogen skriver det (finnes det ikke, brukes FotMobs navn)
const navnAv = new Map(Object.entries(klubber).map(([navn, id]) => [id, navn]));
const klubbNavn = (teamId) => navnAv.get(teamId) ?? lag.get(teamId)?.name;

const keeper = (pos) => /^GK/.test(pos ?? "");
const endringer = [], tvil = [];
for (const r of match) {
  if (!r.fotmobId || /^(flere|usikker)/.test(r.art)) continue;
  const s = katalog.get(r.slug);
  const fm = tropper.get(r.fotmobId);
  if (!s || !fm || s.slug.startsWith("icon-")) continue;
  const nyttLag = fm.teamId;
  const gammeltLag = klubber[s.club];
  if (nyttLag === gammeltLag) continue;
  const nyKlubb = klubbNavn(nyttLag);
  if (!nyKlubb || nyKlubb === s.club) continue;
  const rad = { slug: s.slug, name: s.name, fra: s.club, til: nyKlubb, liga: ligaAv(nyttLag), pos: s.position, fmPos: fm.position, art: r.art, fmNavn: fm.name, alder: fm.age, ny: !navnAv.has(nyttLag) };
  // Keeper mot utespiller er nesten sikkert feil person med samme navn
  if (keeper(s.position) !== keeper(fm.position)) tvil.push({ ...rad, grunn: "keeper/utespiller" });
  else endringer.push(rad);
}

// Liga for alle klubber (så også klubber som har byttet liga siden 0045/0046 blir riktige)
const klubbLiga = new Map();
for (const [navn, id] of Object.entries(klubber)) klubbLiga.set(navn, ligaAv(id));
for (const e of endringer) klubbLiga.set(e.til, e.liga);

const sql = (t) => t.replaceAll("'", "''");
let ut = `-- Klubb og liga fra FotMob (${new Date().toISOString().slice(0, 10)}): ${endringer.length} spillere har byttet klubb siden katalogen sist ble oppdatert (0018/0019).\n`;
ut += `-- * Klubben er den spilleren står på i FotMobs tropp nå (utlånte spillere står på klubben de spiller for, som ellers i katalogen).\n`;
ut += `-- * player_catalog.league følger klubben (0046 satte den fra football_clubs), så den må settes på nytt for dem som bytter klubb. Vi setter den for alle fra klubben:\n`;
ut += `--   de fem store ligaene + Eredivisie, Primeira Liga, Süper Lig og Saudi Pro League, alt annet er 'other'. Icons (league = 'icons') røres ikke.\n`;
ut += `-- * Kortene i klubbene henter klubb og liga fra katalogen, så ingen kort må oppdateres.\n\n`;
ut += `with club_map (slug, club) as (\n  values\n`;
ut += endringer.map((e) => `    ('${e.slug}', '${sql(e.til)}')`).join(",\n") + "\n)\n";
ut += `update player_catalog as catalog\nset club = club_map.club\nfrom club_map\nwhere catalog.slug = club_map.slug and catalog.club is distinct from club_map.club;\n\n`;
ut += `with league_map (club, league) as (\n  values\n`;
ut += [...klubbLiga].sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => `    ('${sql(k)}', '${l}')`).join(",\n") + "\n)\n";
ut += `update player_catalog as catalog\nset league = league_map.league\nfrom league_map\nwhere catalog.club = league_map.club and catalog.league <> 'icons' and catalog.league is distinct from league_map.league;\n\n`;
ut += `-- Resten (klubber som ikke står her, f.eks. «Uten klubb») blir 'other'.\n`;
ut += `update player_catalog set league = 'other'\nwhere league <> 'icons' and league <> 'other' and club not in (select club from (values\n`;
ut += [...klubbLiga.keys()].sort().map((k) => `    ('${sql(k)}')`).join(",\n") + `\n) as known(club));\n`;
writeFileSync(new URL(`../../supabase/migrations/${nr}_klubber_fra_fotmob.sql`, import.meta.url), ut);

let md = `# Klubbendringer fra FotMob\n\n${endringer.length} endringer, ${tvil.length} utelatt som tvilsomme.\n\n| Spiller | Pos (katalog / FotMob) | Fra | Til | Liga | Match | FotMob-navn | Alder |\n|---|---|---|---|---|---|---|--:|\n`;
for (const e of endringer) md += `| ${e.name} | ${e.pos} / ${e.fmPos} | ${e.fra} | ${e.til}${e.ny ? " (ny klubb)" : ""} | ${e.liga} | ${e.art} | ${e.fmNavn} | ${e.alder} |\n`;
if (tvil.length) { md += `\n## Utelatt\n\n`; for (const e of tvil) md += `- ${e.name} (${e.pos}): ${e.fra} → ${e.til} (${e.grunn}, FotMob: ${e.fmNavn} ${e.fmPos})\n`; }
const nye = [...new Set(endringer.filter((e) => e.ny).map((e) => e.til))];
md += `\n## Klubber uten navn i katalogen fra før\n\n${nye.join(", ") || "ingen"}\n`;
writeFileSync(new URL("./data/klubbrapport.md", import.meta.url), md);
console.log(`${endringer.length} endringer, ${tvil.length} tvilsomme, ${nye.length} nye klubber`);
