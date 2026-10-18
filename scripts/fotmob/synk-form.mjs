// Henter kampkarakterer fra FotMob for ferdigspilte kamper siste uke og lagrer dem per katalogspiller i data/form.json.
// Med --skriv skrives de også til databasen (tabellen fotmob_form, migrering 0117), som ukens inform-runde leser.
// Bruk: node scripts/fotmob/synk-form.mjs [--dager 7] [--skriv]
// --skriv krever SUPABASE_DB_URL i miljøet (samme tilkoblingsstreng som migreringsjobben) og at psql er installert.
// Uten --skriv skrives bare data/form.json og data/form.sql, så resultatet kan sjekkes først.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { hentSide } from "./fotmob.mjs";

const arg = (navn) => { const i = process.argv.indexOf(navn); return i >= 0 ? process.argv[i + 1] : null; };
const dager = Number(arg("--dager") ?? 7);
const skriv = process.argv.includes("--skriv");
const naa = Date.now();
const fra = naa - dager * 864e5;

const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
// FotMob-ID -> slug, bare sikre treff (ikke flere/usikre)
const slugAv = new Map(les("match.json").filter((r) => r.fotmobId && !/^(flere|usikker)/.test(r.art)).map((r) => [r.fotmobId, r.slug]));
const ligaer = [...new Set(les("lag.json").map((t) => t.leagueId))];

// 1) Ferdigspilte kamper i vinduet, fra ligasidene (hentes på nytt hver gang, maks 6 timer gamle)
const kamper = new Map();
for (const id of ligaer) {
  try {
    const { sideData } = await hentSide(`/leagues/${id}/overview/x`, `liga-${id}`, { maksAlder: 6 * 3600e3 });
    for (const m of sideData.fixtures?.allMatches ?? []) {
      const t = Date.parse(m.status?.utcTime);
      if (m.status?.finished && !m.status?.cancelled && t >= fra && t <= naa) kamper.set(m.id, { id: m.id, tid: m.status.utcTime });
    }
  } catch (e) {
    console.log(`liga ${id}: FEIL ${e.message}`);
  }
}
console.log(`${kamper.size} ferdigspilte kamper de siste ${dager} dagene`);

// 2) Karakterer fra kampsidene (en ferdigspilt kamp endrer seg ikke, så den caches for alltid)
const verdi = (grupper, nokkel) => grupper?.flatMap((g) => Object.values(g.stats ?? {})).find((s) => s.key === nokkel)?.stat?.value;
const rader = [];
let n = 0;
for (const k of kamper.values()) {
  n++;
  try {
    const { sideData } = await hentSide(`/match/${k.id}`, `kamp-${k.id}`);
    const spillere = sideData.content?.playerStats ?? {};
    for (const [fid, p] of Object.entries(spillere)) {
      const slug = slugAv.get(Number(fid));
      if (!slug) continue;
      const rating = verdi(p.stats, "rating_title");
      const minutter = verdi(p.stats, "minutes_played");
      if (rating == null || minutter == null) continue;
      rader.push({ slug, match_id: k.id, kickoff_at: k.tid, minutes: minutter, rating: Math.round(rating * 10) / 10, goals: verdi(p.stats, "goals") ?? 0, assists: verdi(p.stats, "assists") ?? 0 });
    }
    if (n % 20 === 0) console.log(`${n}/${kamper.size} kamper`);
  } catch (e) {
    console.log(`kamp ${k.id}: FEIL ${e.message}`);
  }
}
writeFileSync(new URL("./data/form.json", import.meta.url), JSON.stringify(rader, null, 1));
console.log(`${rader.length} spillerkarakterer for ${new Set(rader.map((r) => r.slug)).size} katalogspillere`);

// 3) SQL som kan kjøres flere ganger (upsert på spiller + kamp)
const sql = (t) => `'${String(t).replaceAll("'", "''")}'`;
let ut = "-- Generert av scripts/fotmob/synk-form.mjs\n";
for (let i = 0; i < rader.length; i += 500) {
  ut += "insert into fotmob_form (slug, match_id, kickoff_at, minutes, rating, goals, assists) values\n";
  ut += rader.slice(i, i + 500).map((r) => `  (${sql(r.slug)}, ${sql(r.match_id)}, ${sql(r.kickoff_at)}, ${r.minutes}, ${r.rating}, ${r.goals}, ${r.assists})`).join(",\n");
  ut += "\non conflict (slug, match_id) do update set kickoff_at = excluded.kickoff_at, minutes = excluded.minutes, rating = excluded.rating, goals = excluded.goals, assists = excluded.assists;\n";
}
writeFileSync(new URL("./data/form.sql", import.meta.url), ut);

if (skriv) {
  if (!process.env.SUPABASE_DB_URL) throw new Error("Mangler SUPABASE_DB_URL");
  if (!rader.length) throw new Error("Ingen karakterer å skrive, så noe er galt med hentingen");
  execFileSync("psql", [process.env.SUPABASE_DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", new URL("./data/form.sql", import.meta.url).pathname], { stdio: "inherit" });
  console.log(`Skrev ${rader.length} rader til fotmob_form`);
}
