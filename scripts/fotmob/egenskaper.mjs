// Justerer kortenes seks egenskaper (pace, shooting, passing, dribbling, defending, physical) etter FotMobs sesongstatistikk.
// Bruk: node scripts/fotmob/egenskaper.mjs [migreringsnummer]   (med nummer skrives migreringen, ellers bare rapport)
//
// I dag er egenskapene rating + et fast tillegg per posisjon (0012), så alle på samme rating og posisjon er like. Her gir vi hver spiller
// et individuelt avvik fra det, regnet som et snitt av FotMob-percentilene (per 90 min, målt mot andre i samme posisjonsgruppe):
//   pace: Top Speed, Sprinting, Number of Sprints | shooting: Goals, xG, xGOT, Shots, Shots on target
//   passing: xA, Chances created, Pass accuracy, Line-breaking passes, Accurate long balls, Big chances created
//   dribbling: Dribbles, Dribbles success rate, Touches in opposition box, Fouls won, (Dispossessed omvendt)
//   defending: Tackles, Interceptions, Defensive actions, Recoveries, Clearances, Blocked scoring attempt
//   physical: Duels won, Duels won %, Aerials won, Aerials won % + høyde
// Avviket er (snittpercentil - 50) / 50 * MAKS, ganget med en vekt som vokser med spilte minutter (full vekt fra 1 800 min), så en ung
// sesong gir små justeringer. Keepere røres ikke. Rating (overall) endres aldri. Migreringen legger avviket til dagens verdi (20-99).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MAKS = 10;
const FULL_VEKT_MINUTTER = 1800;
const MIN_MINUTTER = 300;
const grupper = {
  pace: ["Top Speed", "Sprinting", "Number of Sprints"],
  shooting: ["Goals", "xG excl. penalty", "xGOT", "Shots", "Shots on target"],
  passing: ["xA", "Chances created", "Pass accuracy", "Line-breaking passes", "Accurate long balls", "Big chances created"],
  dribbling: ["Dribbles", "Dribbles success rate", "Touches in opposition box", "Fouls won", "!Dispossessed"],
  defending: ["Tackles", "Interceptions", "Defensive actions", "Recoveries", "Clearances", "Blocked scoring attempt"],
  physical: ["Duels won", "Duels won %", "Aerials won", "Aerials won %"],
};
const nokler = Object.keys(grupper);

const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const katalog = new Map(les("katalog.json").map((s) => [s.slug, s]));
const match = les("match.json").filter((r) => r.fotmobId && !/^(flere|usikker)/.test(r.art) && !r.slug.startsWith("icon-"));

const rader = [];
let utenData = 0, forLite = 0;
for (const r of match) {
  const s = katalog.get(r.slug);
  if (!s || s.position === "GK") continue;
  const fil = new URL(`./data/cache/spiller-${r.fotmobId}.json`, import.meta.url);
  if (!existsSync(fil)) { utenData++; continue; }
  const side = JSON.parse(readFileSync(fil, "utf8"));
  const p = side.fallback?.[`player:${r.fotmobId}`];
  const minutter = p?.mainLeague?.stats?.find((x) => x.localizedTitleId === "minutes_played")?.value ?? 0;
  const seksjoner = p?.firstSeasonStats?.statsSection?.items;
  if (!seksjoner) { utenData++; continue; }
  if (minutter < MIN_MINUTTER) { forLite++; continue; }
  const prosent = new Map();
  for (const sek of seksjoner) for (const it of sek.items ?? []) if (it.percentileRankPer90 != null) prosent.set(it.title, it.percentileRankPer90);
  const vekt = Math.min(1, minutter / FULL_VEKT_MINUTTER);
  const delta = {};
  for (const [navn, liste] of Object.entries(grupper)) {
    const tall = liste.flatMap((t) => (t.startsWith("!") ? (prosent.has(t.slice(1)) ? [100 - prosent.get(t.slice(1))] : []) : prosent.has(t) ? [prosent.get(t)] : []));
    // For få målinger er for tynt grunnlag
    delta[navn] = tall.length >= 2 ? ((tall.reduce((a, b) => a + b, 0) / tall.length - 50) / 50) * MAKS * vekt : 0;
  }
  const hoyde = p?.playerInformation?.find((i) => i.translationKey === "height_sentencecase")?.value?.numberValue;
  if (hoyde) delta.physical += Math.max(-3, Math.min(3, (Number(hoyde) - 182) / 3));
  const heltall = Object.fromEntries(nokler.map((k) => [k, Math.round(delta[k])]));
  if (nokler.every((k) => heltall[k] === 0)) continue;
  rader.push({ slug: r.slug, name: s.name, position: s.position, overall: s.overall, minutter, vekt: Math.round(vekt * 100) / 100, ...heltall });
}
console.log(`${rader.length} spillere får justert egenskaper (${utenData} uten sesongdata, ${forLite} med under ${MIN_MINUTTER} minutter)`);
for (const k of nokler) {
  const v = rader.map((r) => r[k]);
  console.log(`  ${k.padEnd(10)} snitt ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}  min ${Math.min(...v)}  maks ${Math.max(...v)}`);
}
const vis = ["haaland", "mbappe", "rodri", "kimmich", "van-dijk", "pedri", "salah", "saka", "odegaard", "vinicius", "kane", "declan-rice"];
for (const slug of vis) { const r = rader.find((x) => x.slug === slug); if (r) console.log(`  ${r.name.padEnd(18)} ${r.position.padEnd(3)} ${r.minutter} min (vekt ${r.vekt}): ` + nokler.map((k) => `${k.slice(0, 3)} ${r[k] > 0 ? "+" : ""}${r[k]}`).join("  ")); }

writeFileSync(new URL("./data/egenskaper.json", import.meta.url), JSON.stringify(rader, null, 1));

const nr = process.argv[2];
if (nr) {
  let ut = `-- Egenskapene (pace, shooting, passing, dribbling, defending, physical) justeres etter FotMobs sesongstatistikk (${new Date().toISOString().slice(0, 10)}).\n`;
  ut += `-- Før var de rating + et fast tillegg per posisjon (0012). Nå får hver spiller et individuelt avvik, regnet fra FotMob-percentilene per 90 minutter\n`;
  ut += `-- og lagt til dagens verdi (holdt mellom 20 og 99). Avviket er høyst ${MAKS} og vektet etter spilte minutter (full vekt fra ${FULL_VEKT_MINUTTER}), så\n`;
  ut += `-- en ung sesong gir små justeringer. Rating (overall) endres ikke. Keepere, ikoner og spillere med under ${MIN_MINUTTER} minutter røres ikke.\n`;
  ut += `-- Skriptet som regnet dem ut: scripts/fotmob/egenskaper.mjs. ${rader.length} spillere.\n`;
  ut += `-- Kort som allerede er eid får de nye verdiene i basisegenskapene; informs og andre spesialkort beholder sine egne verdier.\n\n`;
  ut += `update player_catalog as catalog\nset attributes = catalog.attributes || jsonb_build_object(\n`;
  ut += nokler.map((k) => `  '${k}', least(99, greatest(20, coalesce((catalog.attributes->>'${k}')::integer, catalog.overall) + d.${k}))`).join(",\n") + "\n)\n";
  ut += `from (values\n` + rader.map((r) => `    ('${r.slug}', ${nokler.map((k) => r[k]).join(", ")})`).join(",\n") + `\n) as d (slug, ${nokler.join(", ")})\nwhere catalog.slug = d.slug;\n\n`;
  ut += `update manager_cards as card\nset attributes = catalog.attributes\nfrom player_catalog as catalog\nwhere card.catalog_id = catalog.id\n  and card.special_card_id is null\n  and card.attributes is distinct from catalog.attributes\n  and catalog.slug in (select slug from (values\n`;
  ut += rader.map((r) => `    ('${r.slug}')`).join(",\n") + `\n  ) as changed (slug));\n`;
  writeFileSync(new URL(`../../supabase/migrations/${nr}_egenskaper_fra_fotmob.sql`, import.meta.url), ut);
  console.log(`Skrev ${nr}_egenskaper_fra_fotmob.sql`);
}
