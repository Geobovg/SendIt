// Matcher katalogspillerne mot FotMob-spillerne (data/tropper.json) og skriver data/match.json.
// Bruk: node scripts/fotmob/match.mjs
// Sikkerhet: "klubb-eksakt" og "klubb-delvis" er trygge, "annen-klubb" er trolig overgang (sjekk), "usikker" må sjekkes for hånd.
import { readFileSync, writeFileSync } from "node:fs";
import { normaliser } from "./fotmob.mjs";

const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const katalog = les("katalog.json");
const klubber = les("klubber.json");
const tropper = les("tropper.json");

const deler = (navn) => normaliser(navn).split(" ").filter(Boolean);
const fm = tropper.map((p) => ({ ...p, norm: normaliser(p.name), tokens: deler(p.name) }));

// Navn som er skrevet annerledes i katalogen (slug -> FotMob-navn) legges inn her etter hvert som vi finner dem.
const manuelle = existsOverrides();
function existsOverrides() {
  try { return les("manuelle.json"); } catch { return {}; }
}

// a = katalognavn, b = FotMob-navn (som tokens)
function delvis(a, b) {
  // Alle ordene i det korteste navnet finnes i det lengste (Vinícius Júnior ~ Vinicius Junior, Alisson ~ Alisson Becker).
  // Ett enkelt ord hos FotMob (Kevin, Pedro, Marcelo) er for svakt til å regnes som treff på et lengre katalognavn.
  const [kort, lang] = a.length <= b.length ? [a, b] : [b, a];
  if (kort === b && kort.length === 1 && a.length > 1) return false;
  if (kort.length === 1 && kort[0].length < 4) return false;
  return kort.every((t) => lang.includes(t)) ||
    // Etternavn likt + fornavn starter likt (Dani Carvajal ~ Daniel Carvajal)
    (a.at(-1) === b.at(-1) && a.length > 1 && b.length > 1 && (a[0].startsWith(b[0]) || b[0].startsWith(a[0])));
}

const resultat = [];
for (const s of katalog) {
  const tokens = deler(s.name);
  const norm = tokens.join(" ");
  const lagId = klubber[s.club];
  const manuell = manuelle[s.slug];
  let treff = [];
  let art = "ingen";
  // Ikonene er pensjonert og finnes ikke i troppene (et navn som "Marcelo" ville bare truffet feil spiller)
  if (s.slug.startsWith("icon-") || !s.club) {
    resultat.push({ slug: s.slug, name: s.name, club: s.club, position: s.position, overall: s.overall, art: "ikon", fotmobId: null });
    continue;
  }
  if (manuell) {
    treff = fm.filter((p) => p.id === manuell);
    art = "manuell";
  } else {
    const iKlubb = fm.filter((p) => p.teamId === lagId);
    const kandidater = [
      ["klubb-eksakt", iKlubb.filter((p) => p.norm === norm)],
      ["klubb-delvis", iKlubb.filter((p) => delvis(tokens, p.tokens))],
      ["annen-klubb", fm.filter((p) => p.norm === norm)],
      ["usikker", fm.filter((p) => delvis(tokens, p.tokens))],
    ];
    for (const [a, liste] of kandidater) if (liste.length) { treff = liste; art = a; break; }
  }
  const unik = treff.length === 1;
  const p = unik ? treff[0] : null;
  resultat.push({
    slug: s.slug, name: s.name, club: s.club, position: s.position, overall: s.overall,
    art: unik || !treff.length ? art : `flere-${art}`,
    fotmobId: p?.id ?? null, fotmobName: p?.name ?? null, fotmobTeam: p?.team ?? null, fotmobPosition: p?.position ?? null,
    kandidater: unik ? undefined : treff.slice(0, 6).map((k) => `${k.id} ${k.name} (${k.team}, ${k.position})`),
  });
}
writeFileSync(new URL("./data/match.json", import.meta.url), JSON.stringify(resultat, null, 1));

const per = {};
for (const r of resultat) per[r.art] = (per[r.art] ?? 0) + 1;
console.log(per);
