// Foreslår overgangsmarkedspris (MB) for de 100 beste katalogspillerne ut fra FotMobs markedsverdi.
// Bruk: node scripts/fotmob/prisforslag.mjs   (leser data/katalog.json og data/profiler.json, skriver data/prisforslag.md og .csv)
//
// Dagens verdi i appen er en ren funksjon av ratingen (verdikurven i 0034). Markedsverdi og rating henger løst sammen blant de
// beste (alder og kontrakt påvirker verdien mye), så en regresjon av pris mot verdi blir flat og kutter alle priser. I stedet:
//  1. Hver spiller får en "verdi-rating": markedsverdien rangert blant de 100 og oversatt til ratingen på samme plass (kvantilmatching).
//     Da har den samme skala og fordeling som ratingene, og MB-økonomien blir omtrent uendret.
//  2. Blandet rating = VEKT * verdi-rating + (1 - VEKT) * rating.
//  3. Prisen er verdikurven fra 0034 lest av på den blandede ratingen (log-lineær mellom punktene), rundet av.
import { readFileSync, writeFileSync } from "node:fs";
import { normaliser } from "./fotmob.mjs";

const VEKT = 0.5;
const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const katalog = les("katalog.json");
const profiler = les("profiler.json");

const topp = katalog.filter((s) => s.club && !s.slug.startsWith("icon-")).sort((a, b) => b.overall - a.overall || b.price - a.price).slice(0, 100);
const med = topp.filter((s) => profiler[s.slug]?.marketValueEur);
const mangler = topp.filter((s) => !profiler[s.slug]?.marketValueEur);

// Verdikurven fra 0034 (rating -> MB); 93 og oppover er 2000
const kurve = [[84, 100], [85, 140], [86, 200], [87, 280], [88, 400], [89, 560], [90, 800], [91, 1100], [92, 1500], [93, 2000]];
function kurvePris(r) {
  const i = Math.min(Math.max(Math.floor(r) - 84, 0), kurve.length - 2);
  const [r0, p0] = kurve[i], [r1, p1] = kurve[i + 1];
  return Math.min(2000, Math.exp(Math.log(p0) + (r - r0) * (Math.log(p1) - Math.log(p0))));
}
const pen = (x) => { const steg = x < 100 ? 5 : x < 500 ? 10 : x < 1000 ? 25 : 50; return Math.max(steg, Math.round(x / steg) * steg); };

const ratinger = med.map((s) => s.overall).sort((x, y) => y - x);
const etterVerdi = [...med].sort((x, y) => profiler[y.slug].marketValueEur - profiler[x.slug].marketValueEur);
const verdiRating = new Map(etterVerdi.map((s, i) => [s.slug, ratinger[i]]));
const mverdiKurve = (r) => kurvePris(r);

const alder = (f) => (f ? Math.floor((Date.now() - new Date(f)) / 31557600000) : null);

const rader = med.map((s, i) => {
  const p = profiler[s.slug];
  const blandet = VEKT * verdiRating.get(s.slug) + (1 - VEKT) * s.overall;
  const forslag = pen(kurvePris(blandet));
  return { nr: i + 1, name: s.name, club: s.club, fotmobTeam: p.team, position: s.position, overall: s.overall, age: alder(p.born), mverdi: p.marketValueEur / 1e6, verdiRating: verdiRating.get(s.slug), blandet, naa: s.price, forslag, endring: Math.round((forslag / s.price - 1) * 100) };
});

const f = (x, d = 0) => x.toLocaleString("nb-NO", { minimumFractionDigits: d, maximumFractionDigits: d });
let md = `# Prisforslag for de 100 beste (MB)\n\n`;
md += `Markedsverdi fra FotMob (siste oppføring, ${med.map((s) => profiler[s.slug].marketValueDate?.slice(0, 7)).sort().at(-1)}). Dagens verdi er verdikurven fra migrering 0034 (rating 84 = 100 MB … 92 = 1 500 MB, 93+ = 2 000 MB).\n\n`;
md += `**Metode.** Hver spiller får en *verdi-rating*: markedsverdien rangert blant de 100 og oversatt til ratingen på samme plass. Blandet rating = ${VEKT * 100} % verdi-rating + ${(1 - VEKT) * 100} % rating, og prisen leses av verdikurven på den blandede ratingen og rundes av. Totalt MB-nivå blir omtrent som i dag; spillere med høy markedsverdi i forhold til rating går opp, gamle stjerner med lav verdi går ned. Markedspriser i appen kan settes mellom 25 % og 400 % av verdien.\n\n`;
md += `| # | Spiller | Klubb (katalog → FotMob) | Pos | OVR | Alder | Markedsverdi (M€) | Verdi-rating | Nå (MB) | **Forslag (MB)** | Endring |\n|--:|---|---|---|--:|--:|--:|--:|--:|--:|--:|\n`;
for (const r of rader) {
  const ens = (a, b) => normaliser(a).includes(normaliser(b)) || normaliser(b).includes(normaliser(a));
  const klubb = ens(r.club, r.fotmobTeam) ? r.club : `${r.club} → **${r.fotmobTeam}**`;
  md += `| ${r.nr} | ${r.name} | ${klubb} | ${r.position} | ${r.overall} | ${r.age ?? ""} | ${f(r.mverdi, 1)} | ${r.verdiRating} | ${f(r.naa)} | **${f(r.forslag)}** | ${r.endring > 0 ? "+" : ""}${r.endring} % |\n`;
}
const sum = (k) => rader.reduce((x, r) => x + r[k], 0);
md += `\nSum for de ${rader.length}: i dag ${f(sum("naa"))} MB, forslag ${f(sum("forslag"))} MB (${Math.round((sum("forslag") / sum("naa") - 1) * 100)} %).\n`;
if (mangler.length) md += `\nMangler FotMob-verdi (ikke med i beregningen): ${mangler.map((s) => `${s.name} (${s.club})`).join(", ")}\n`;
writeFileSync(new URL("./data/prisforslag.md", import.meta.url), md);
writeFileSync(new URL("./data/prisforslag.csv", import.meta.url), "nr;spiller;klubb;fotmob_klubb;pos;ovr;alder;markedsverdi_meur;verdi_rating;naa_mb;forslag_mb;endring_pst\n" + rader.map((r) => [r.nr, r.name, r.club, r.fotmobTeam, r.position, r.overall, r.age, r.mverdi.toFixed(1), r.verdiRating, r.naa, r.forslag, r.endring].join(";")).join("\n"));
console.log(`${rader.length} spillere, ${mangler.length} mangler`);
console.log(md.split("\n").slice(4, 40).join("\n"));
