// Leser spillerkatalogen ut av migreringene (vi har ikke databasetilgang herfra) og skriver data/katalog.json.
// Bruk: node scripts/fotmob/bygg-katalog.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const migrasjoner = new URL("../../supabase/migrations/", import.meta.url);
const ut = new URL("./data/", import.meta.url);
const filer = readdirSync(migrasjoner).filter((f) => f.endsWith(".sql")).sort();

const katalog = new Map();
const klubber = new Map();
const posisjoner = "GK|RB|CB|LB|CDM|CM|CAM|RW|LW|ST";
// ('slug','Navn','POS',overall,pris,... – i alle migreringene som legger inn spillere
const spiller = new RegExp(`\\(\\s*'([a-z0-9-]+)'\\s*,\\s*'((?:[^']|'')+)'\\s*,\\s*'(${posisjoner})'\\s*,\\s*(\\d+)(?:\\s*,\\s*(\\d+)\\s*,\\s*'#[0-9a-f]{3,8}'\\s*,\\s*'((?:[^']|'')+)')?`, "g");
// ('slug', 'Klubb') i klubbmigreringene
const klubb = /\(\s*'([a-z0-9-]+)'\s*,\s*'((?:[^']|'')+)'\s*\)/g;

for (const fil of filer) {
  const sql = readFileSync(new URL(fil, migrasjoner), "utf8");
  for (const [, slug, navn, posisjon, overall, pris, k] of sql.matchAll(spiller)) {
    // 'on conflict do nothing' er vanlig, så første innlegging er den som gjelder
    if (!katalog.has(slug)) katalog.set(slug, { slug, name: navn.replaceAll("''", "'"), position: posisjon, overall: Number(overall), price: pris ? Number(pris) : null });
    if (k && !klubber.has(slug)) klubber.set(slug, k.replaceAll("''", "'"));
  }
  // Ratingjusteringer etter at spillerne ble lagt inn: 0016 (Nusa 83), 0027 (løft, bare oppover), 0030 (faste mål)
  const justeringer = /^(0027|0030)_/.test(fil) ? [...sql.matchAll(/\(\s*'([a-z0-9-]+)'\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)] : [];
  for (const [, slug, overall, pris] of justeringer) {
    const s = katalog.get(slug);
    if (!s) continue;
    if (fil.startsWith("0027") ? s.overall < Number(overall) : true) { s.overall = Number(overall); s.price = Math.max(fil.startsWith("0027") ? (s.price ?? 0) : 0, Number(pris)); }
  }
  if (fil.startsWith("0016") && katalog.has("nusa")) Object.assign(katalog.get("nusa"), { overall: 83, price: 80 });
  if (/club/i.test(fil) || /clubs?_map|set club/i.test(sql)) {
    for (const [, slug, k] of sql.matchAll(klubb)) klubber.set(slug, k.replaceAll("''", "'"));
  }
}

// 0034: fra 84 og opp følger prisen ratingen (verdikurven), uansett hva som stod i innleggingen
const kurve = { 84: 100, 85: 140, 86: 200, 87: 280, 88: 400, 89: 560, 90: 800, 91: 1100, 92: 1500 };
const liste = [...katalog.values()].map((s) => ({ ...s, price: s.overall >= 84 ? (kurve[s.overall] ?? 2000) : s.price, club: klubber.get(s.slug) ?? null }));
mkdirSync(ut, { recursive: true });
writeFileSync(new URL("katalog.json", ut), JSON.stringify(liste, null, 1));

// Sammenlign med slugene i 0112 (hele katalogen) for å se at vi fikk med alle
const alle = new Set([...readFileSync(new URL("0112_alt_posisjoner_fra_fotmob.sql", migrasjoner), "utf8").matchAll(/^\s*\('([a-z0-9-]+)',\s*array/gm)].map((m) => m[1]));
const mangler = [...alle].filter((s) => !katalog.has(s));
console.log(`${liste.length} spillere, ${liste.filter((s) => s.club).length} med klubb. 0112 har ${alle.size}; mangler navn for ${mangler.length}`, mangler.slice(0, 15));
