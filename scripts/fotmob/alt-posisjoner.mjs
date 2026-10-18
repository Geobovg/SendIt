// Beregner alternative posisjoner fra FotMob-profilene med samme regler som migrering 0112, og sammenligner med 0112.
// Bruk: node scripts/fotmob/alt-posisjoner.mjs [migreringsnummer]   (med nummer skrives en migrering med bare endringene)
// Regler (0112): en posisjon teller når spilleren har spilt den minst 3 ganger og minst 10 % så ofte som sin mest brukte.
// AM -> CAM, DM -> CDM, RM/LM -> RW/LW, RWB/LWB -> RB/LB. Under 5 kamper totalt er for lite å bygge på.
import { readFileSync, writeFileSync } from "node:fs";

const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const katalog = new Map(les("katalog.json").map((s) => [s.slug, s]));
const profiler = les("profiler.json");
const oversett = { AM: "CAM", DM: "CDM", RM: "RW", LM: "LW", RWB: "RB", LWB: "LB" };

// Dagens verdier = 0112 (siste migrering som setter alt_positions for hele katalogen)
const sql0112 = readFileSync(new URL("../../supabase/migrations/0112_alt_posisjoner_fra_fotmob.sql", import.meta.url), "utf8");
const naa = new Map([...sql0112.matchAll(/^\s*\('([a-z0-9-]+)',\s*array(?:\[\]::text\[\]|\[([^\]]*)\])\)/gm)].map((m) => [m[1], [...(m[2] ?? "").matchAll(/'(\w+)'/g)].map((x) => x[1])]));

const ny = new Map();
for (const [slug, p] of Object.entries(profiler)) {
  const s = katalog.get(slug);
  if (!s || slug.startsWith("icon-")) continue;
  const tall = new Map();
  for (const q of p.positions ?? []) {
    const pos = oversett[q.pos] ?? q.pos;
    tall.set(pos, (tall.get(pos) ?? 0) + (q.kamper ?? 0));
  }
  const total = [...tall.values()].reduce((a, b) => a + b, 0);
  if (total < 5) continue;
  const mest = Math.max(...tall.values());
  const alt = [...tall].filter(([pos, n]) => n >= 3 && n >= 0.1 * mest && pos !== s.position).sort((a, b) => b[1] - a[1]).map(([pos]) => pos);
  ny.set(slug, alt);
}

const like = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const endret = [], nye = [];
for (const [slug, alt] of ny) {
  if (!naa.has(slug)) nye.push([slug, alt]);
  else if (!like(alt, naa.get(slug))) endret.push([slug, naa.get(slug), alt]);
}
console.log(`${ny.size} spillere beregnet. ${endret.length} endret fra 0112, ${nye.length} ikke i 0112 fra før.`);
for (const [slug, fra, til] of endret) console.log(`  ${katalog.get(slug).name} (${katalog.get(slug).position}): [${fra}] -> [${til}]`);
for (const [slug, alt] of nye) console.log(`  NY ${katalog.get(slug).name} (${katalog.get(slug).position}): [${alt}]`);

const nr = process.argv[2];
if (nr) {
  const rader = [...endret.map(([s, , t]) => [s, t]), ...nye];
  if (!rader.length) { console.log("Ingen endringer, skriver ingen migrering."); process.exit(0); }
  const arr = (a) => (a.length ? `array[${a.map((x) => `'${x}'`).join(", ")}]` : "array[]::text[]");
  let ut = `-- Alternative posisjoner oppdatert fra FotMob (${new Date().toISOString().slice(0, 10)}), samme regler som 0112.\n-- Bare spillere der listen er endret siden 0112 er med (${rader.length} stk).\n\n`;
  ut += `update player_catalog as catalog\nset alt_positions = alt.positions\nfrom (values\n${rader.map(([s, a]) => `    ('${s}', ${arr(a)})`).join(",\n")}\n) as alt (slug, positions)\nwhere catalog.slug = alt.slug\n  and catalog.alt_positions is distinct from alt.positions::text[];\n\n`;
  ut += `update manager_cards as card\nset alt_positions = catalog.alt_positions\nfrom player_catalog as catalog\nwhere card.catalog_id = catalog.id\n  and card.alt_positions is distinct from catalog.alt_positions;\n`;
  writeFileSync(new URL(`../../supabase/migrations/${nr}_alt_posisjoner_fra_fotmob.sql`, import.meta.url), ut);
  console.log(`Skrev ${nr}_alt_posisjoner_fra_fotmob.sql`);
}
