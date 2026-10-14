// Hvor ofte rykker et lag med en gitt snittrating opp i AI-sesongen? Spiller hele sesonger (ti kamper mot de fem
// klubbene i divisjonen) med den ekte kampmotoren, og AI mot AI med samme modell som simulate_ai_goals i databasen.
// Bruk: node scripts/simulate-arenas.mjs [sesonger=60] [ratinger=82,86,90,94] [divisjoner=10,6,1] [kjemi=2]
// Tallene hentes fra src/lib/arenas.ts, så endringer der kan sammenlignes med de gamle tallene i docs/adr/0002.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const modules = new Map();
function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  modules.set(url.href, exports);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const require = (name) => { assert.ok(name.startsWith("./"), `Unexpected dependency: ${name}`); return load(new URL(`${name}.ts`, url)); };
  new Function("require", "exports", outputText)(require, exports);
  return exports;
}
const match = load(new URL("../src/lib/manager-match.ts", import.meta.url));
const { formations } = load(new URL("../src/lib/lineup.ts", import.meta.url));
const { arenas, divisionRating } = load(new URL("../src/lib/arenas.ts", import.meta.url));

const seasons = Number(process.argv[2] ?? 60);
const ratings = (process.argv[3] ?? "82,86,90,94").split(",").map(Number);
const divisions = (process.argv[4] ?? "10,6,1").split(",").map(Number);
const userChemistry = Number(process.argv[5] ?? 2);
const AI_CHEMISTRY = 2;

const team = (id, rating, chemistry, bonus = 0) => ({
  userId: id, formation: "4-3-3", chemistryBonus: chemistry, ...(bonus ? { bonus } : {}),
  starters: formations["4-3-3"].map((slot, index) => ({ id: `${id}${index}`, name: `${id}${index}`, position: slot.position, overall: rating })),
  bench: ["GK", "CB", "CM", "ST"].map((position, index) => ({ id: `${id}b${index}`, name: `${id}b${index}`, position, overall: rating - 3 })),
});
const aiGoals = (own, other) => Math.min(6, Math.max(0, Math.floor(Math.random() * 3.2 + (own - other) / 8 + Math.random() * 0.8)));
const spots = (division) => (division >= 7 ? 2 : 1);

console.log(`Sjanse for opprykk (topp 2 i divisjon 10–7, vinner i 6–1) og poeng per kamp, ${seasons} sesonger, kjemi ${userChemistry} per spiller`);
console.log("".padEnd(24) + ratings.map((rating) => `R=${rating}`.padEnd(11)).join(""));
for (const arena of arenas) for (const division of divisions) {
  const row = ratings.map((rating) => {
    let promoted = 0; let points = 0;
    for (let season = 0; season < seasons; season += 1) {
      const aiRatings = arena.offsets.map((offset) => Math.min(99, divisionRating(arena.number, division) + offset));
      const table = Array.from({ length: 6 }, () => ({ pts: 0, gd: 0, gf: 0 }));
      const add = (index, scored, conceded) => { table[index].pts += scored > conceded ? 3 : scored === conceded ? 1 : 0; table[index].gd += scored - conceded; table[index].gf += scored; };
      aiRatings.forEach((aiRating, index) => {
        for (const home of [true, false]) {
          const mine = team("u", rating, userChemistry); const theirs = team("a", aiRating, AI_CHEMISTRY, arena.bonus);
          const events = match.planManagerTimeline(`sim:${season}:${rating}:${division}:${arena.number}:${index}:${home}:${Math.random()}`, [{ type: "kickoff", version: match.MANAGER_KICKOFF_VERSION, home: home ? mine : theirs, away: home ? theirs : mine }]);
          let homeGoals = 0; let awayGoals = 0;
          for (const event of events) if (event.type === "goal") { if (event.side === "home") homeGoals += 1; else awayGoals += 1; }
          const own = home ? homeGoals : awayGoals; const other = home ? awayGoals : homeGoals;
          add(0, own, other); add(index + 1, other, own);
        }
      });
      for (let i = 0; i < 5; i += 1) for (let j = 0; j < 5; j += 1) if (i !== j) {
        const first = aiGoals(aiRatings[i], aiRatings[j]); const second = aiGoals(aiRatings[j], aiRatings[i]);
        add(i + 1, first, second); add(j + 1, second, first);
      }
      const order = table.map((entry, index) => ({ ...entry, index })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || Math.random() - 0.5);
      if (order.findIndex((entry) => entry.index === 0) + 1 <= spots(division)) promoted += 1;
      points += table[0].pts / 10;
    }
    return `${Math.round((100 * promoted) / seasons)}% (${(points / seasons).toFixed(1)})`.padEnd(11);
  });
  console.log(`A${arena.number} d${String(division).padStart(2)} AI ${divisionRating(arena.number, division)} +${arena.bonus}`.padEnd(24) + row.join(""));
}
