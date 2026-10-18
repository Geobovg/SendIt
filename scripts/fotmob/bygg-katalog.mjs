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
const spiller = new RegExp(`\\(\\s*'([a-z0-9-]+)'\\s*,\\s*'((?:[^']|'')+)'\\s*,\\s*'(${posisjoner})'\\s*,\\s*(\\d+)(?:\\s*,\\s*\\d+\\s*,\\s*'#[0-9a-f]{3,8}'\\s*,\\s*'((?:[^']|'')+)')?`, "g");
// ('slug', 'Klubb') i klubbmigreringene
const klubb = /\(\s*'([a-z0-9-]+)'\s*,\s*'((?:[^']|'')+)'\s*\)/g;

for (const fil of filer) {
  const sql = readFileSync(new URL(fil, migrasjoner), "utf8");
  for (const [, slug, navn, posisjon, overall, k] of sql.matchAll(spiller)) {
    katalog.set(slug, { slug, name: navn.replaceAll("''", "'"), position: posisjon, overall: Number(overall) });
    if (k && !klubber.has(slug)) klubber.set(slug, k.replaceAll("''", "'"));
  }
  if (/club/i.test(fil) || /clubs?_map|set club/i.test(sql)) {
    for (const [, slug, k] of sql.matchAll(klubb)) klubber.set(slug, k.replaceAll("''", "'"));
  }
}

const liste = [...katalog.values()].map((s) => ({ ...s, club: klubber.get(s.slug) ?? null }));
mkdirSync(ut, { recursive: true });
writeFileSync(new URL("katalog.json", ut), JSON.stringify(liste, null, 1));

// Sammenlign med slugene i 0112 (hele katalogen) for å se at vi fikk med alle
const alle = new Set([...readFileSync(new URL("0112_alt_posisjoner_fra_fotmob.sql", migrasjoner), "utf8").matchAll(/^\s*\('([a-z0-9-]+)',\s*array/gm)].map((m) => m[1]));
const mangler = [...alle].filter((s) => !katalog.has(s));
console.log(`${liste.length} spillere, ${liste.filter((s) => s.club).length} med klubb. 0112 har ${alle.size}; mangler navn for ${mangler.length}`, mangler.slice(0, 15));
