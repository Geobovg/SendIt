// Henter lagsidene (med tropp) fra FotMob for lagene katalogen bruker, og samler spillerne i data/tropper.json.
// Bruk: node scripts/fotmob/hent-tropper.mjs [alle]   (uten argument: bare lagene i katalogen)
import { readFileSync, writeFileSync } from "node:fs";
import { hentSide } from "./fotmob.mjs";

const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const lag = les("lag.json");
const ider = process.argv[2] === "alle" ? lag.map((t) => t.id) : [...new Set(Object.values(les("klubber.json")))];

const spillere = [];
let n = 0;
for (const id of ider) {
  n++;
  try {
    const { sideData, fraCache } = await hentSide(`/teams/${id}/overview/x`, `lag-${id}`);
    const t = sideData.fallback?.[`team-${id}`];
    const grupper = t?.squad?.squad ?? [];
    let antall = 0;
    for (const g of grupper) {
      if (["coach", "coaches"].includes(g.title)) continue;
      for (const m of g.members ?? []) {
        antall++;
        spillere.push({ id: m.id, name: m.name, group: g.title, role: m.role?.key, teamId: Number(id), team: t.details.name, position: m.positionIdsDesc, ccode: m.ccode, cname: m.cname, height: m.height, age: m.age, born: m.dateOfBirth, shirt: m.shirtNumber, rating: m.rating, goals: m.goals, assists: m.assists, injury: m.injury ?? null, value: m.transferValue });
      }
    }
    console.log(`${n}/${ider.length} ${fraCache ? "(cache) " : ""}${t?.details?.name ?? id}: ${antall} spillere`);
  } catch (e) {
    console.log(`${n}/${ider.length} ${id}: FEIL ${e.message}`);
  }
}
writeFileSync(new URL("./data/tropper.json", import.meta.url), JSON.stringify(spillere));
console.log(`${spillere.length} spillere totalt`);
