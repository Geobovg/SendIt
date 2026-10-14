import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Kjører de ekte TypeScript-modulene uten database eller Next.
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
const chem = load(new URL("../src/lib/chemistry.ts", import.meta.url));
const match = load(new URL("../src/lib/manager-match.ts", import.meta.url));
const { formations } = load(new URL("../src/lib/lineup.ts", import.meta.url));

const p = (id, club, league, nation, extra = {}) => ({ id, club, league, nation, ...extra });
const points = (players) => Object.fromEntries(chem.chemistryOf(players));

// --- Reglene ---
// Klubb: 2 / 4 / 7 gir 1 / 2 / 3 poeng.
for (const [count, expected] of [[1, 0], [2, 1], [3, 1], [4, 2], [6, 2], [7, 3], [11, 3]]) {
  const players = Array.from({ length: count }, (_, i) => p(`c${i}`, "Arsenal", "other", null));
  assert.equal(points(players).c0, expected, `${count} fra samme klubb`);
}
// Liga: 3 / 5 / 8 (ulike klubber og nasjoner).
for (const [count, expected] of [[2, 0], [3, 1], [5, 2], [8, 3]]) {
  const players = Array.from({ length: count }, (_, i) => p(`l${i}`, `Klubb ${i}`, "premier_league", `n${i}`));
  assert.equal(points(players).l0, expected, `${count} fra samme liga`);
}
// Nasjon: 2 / 5 / 8.
for (const [count, expected] of [[1, 0], [2, 1], [5, 2], [8, 3]]) {
  const players = Array.from({ length: count }, (_, i) => p(`n${i}`, `Klubb ${i}`, `liga${i}`, "no"));
  assert.equal(points(players).n0, expected, `${count} fra samme nasjon`);
}
// Summen kappes på 3, og full kjemi er 33.
const stacked = Array.from({ length: 11 }, (_, i) => p(`s${i}`, "Arsenal", "premier_league", "gb-eng"));
assert.ok(Object.values(points(stacked)).every((value) => value === 3));
assert.equal(chem.teamChemistry(stacked), chem.MAX_TEAM_CHEMISTRY);
assert.equal(chem.MAX_TEAM_CHEMISTRY, 33);
// Poeng fra tre kilder summeres.
const mixed = [p("a", "X", "pl", "no"), p("b", "X", "pl", "no"), p("c", "Y", "pl", "se")];
assert.equal(points(mixed).a, 3); // klubb 2 (1), liga 3 (1), nasjon 2 (1)
assert.equal(points(mixed).c, 1); // liga 3 (1), klubb 1 og nasjon 1 gir ingenting
// «other» og ukjente klubber gir ingenting.
const unknown = Array.from({ length: 11 }, (_, i) => p(`u${i}`, i % 2 ? "Uten klubb" : "Ukjent klubb", "other", null));
assert.equal(chem.teamChemistry(unknown), 0);
const celticFlamengo = [p("a", "Celtic", "other", "br"), p("b", "Flamengo", "other", "ar"), p("c", "Inter Miami", "other", "us")];
assert.equal(chem.teamChemistry(celticFlamengo), 0);
// Spillere uten data (Academy, AI) får 0.
assert.equal(chem.teamChemistry([{ id: "a" }, { id: "b" }, { id: "c" }]), 0);
// Personlig kort: alltid 3, men teller ikke for andre.
const withPersonal = [{ id: "me", personal: true }, p("a", "Arsenal", "premier_league", "no"), p("b", "Arsenal", "premier_league", "no")];
assert.equal(points(withPersonal).me, 3);
assert.equal(points(withPersonal).a, 2); // klubb 2 (1) + nasjon 2 (1); personlig kort teller ikke
// Ikon: alltid 3, teller dobbelt for nasjonen og som én for alle ligaer.
const withIcon = [p("icon", "Icons", "icons", "no"), p("a", "Arsenal", "premier_league", "no"), p("b", "Chelsea", "premier_league", "se")];
assert.equal(points(withIcon).icon, 3);
assert.equal(points(withIcon).a, 1 + 1); // liga 2 + ikonet = 3 (1), nasjon 1 + 2 = 3 (1), klubb 1 (0)
assert.equal(points(withIcon).b, 1); // liga (1), nasjon 1 (0)

// --- Kampmotoren ---
const slots = formations["4-3-3"];
const team = (userId, rating, build, extra = {}) => ({
  userId, formation: "4-3-3",
  starters: slots.map((slot, i) => ({ id: `${userId}s${i}`, name: `S${i}`, position: slot.position, overall: rating, shooting: rating, ...build(i) })),
  bench: ["GK", "CB", "LB", "CM", "RW", "ST", "CM"].map((position, i) => ({ id: `${userId}b${i}`, name: `B${i}`, position, overall: rating - 10, shooting: rating - 10 })),
  ...extra,
});
const sameClub = () => ({ club: "Arsenal", league: "premier_league", nation: "gb-eng" });
const noChem = (i) => ({ club: `Klubb ${i}`, league: `liga${i}`, nation: `nasjon${i}` });
const kickoff = (home, away, version = match.MANAGER_KICKOFF_VERSION, extra = {}) => ({ type: "kickoff", version, home, away, ...extra });
assert.equal(match.MANAGER_KICKOFF_VERSION, 7);

const goals = (events) => match.getManagerGoals(events);
function record(makeHome, makeAway, version, weight, games = 1200) {
  let wins = 0, losses = 0;
  for (let i = 0; i < games; i += 1) {
    const events = match.planManagerTimeline(`m${i}`, [kickoff(makeHome(), makeAway(), version, weight ? { ratingWeight: weight } : {})]);
    const home = goals(events).filter((g) => g.side === "home").length, away = goals(events).filter((g) => g.side === "away").length;
    if (home > away) wins += 1; else if (home < away) losses += 1;
  }
  return { wins, losses };
}
// Et lag med full kjemi vinner oftere enn et like godt lag uten.
const withChem = record(() => team("h", 85, sameClub), () => team("a", 85, noChem), 7, 0);
assert.ok(withChem.wins - withChem.losses > 150, `full kjemi: ${JSON.stringify(withChem)}`);
const without = record(() => team("h", 85, noChem), () => team("a", 85, noChem), 7, 0);
assert.ok(Math.abs(without.wins - without.losses) < 120, `ingen kjemi: ${JSON.stringify(without)}`);
// Eldre kamper (versjon 6) ignorerer kjemi.
const old = record(() => team("h", 85, sameClub), () => team("a", 85, noChem), 6, 0);
assert.ok(Math.abs(old.wins - old.losses) < 120, `versjon 6: ${JSON.stringify(old)}`);
// En fast AI-kjemi gir bonusen til alle uten data.
const fixed = record(() => team("h", 85, () => ({}), { chemistryBonus: 3 }), () => team("a", 85, () => ({})), 7, 0);
assert.ok(fixed.wins - fixed.losses > 150, `fast kjemi: ${JSON.stringify(fixed)}`);
// Kjemien regnes ut igjen for dem som står på banen: kjemi lagres på straffene.
const shots = Array.from({ length: 30 }, (_, i) => match.getManagerShots(match.planManagerTimeline(`shots${i}`, [kickoff(team("h", 85, sameClub), team("a", 85, noChem))]))).flat();
assert.ok(shots.length > 0);
for (const shot of shots) {
  assert.equal(typeof shot.takerChem, "number");
  assert.equal(typeof shot.keeperChem, "number");
  assert.equal(shot.takerChem, shot.side === "home" ? 3 : 0);
  assert.equal(shot.keeperChem, shot.side === "home" ? 0 : 3);
}
// withChemistry legger til kjemien og lar kortets egen rating være.
const boosted = match.withChemistry(team("h", 80, sameClub), team("h", 80, sameClub).starters, 7);
assert.ok(boosted.every((player) => player.overall === 83 && player.shooting === 83 && player.chem === 3));
assert.ok(match.withChemistry(team("h", 80, sameClub), team("h", 80, sameClub).starters, 6).every((player) => player.overall === 80));
// --- «Velg beste tropp» med kjemi ---
const lineupLib = load(new URL("../src/lib/lineup.ts", import.meta.url));
const positionsOf = slots.map((slot) => slot.position);
const strong = positionsOf.map((position, i) => ({ id: `strong${i}`, position, overall: 82, club: `Klubb ${i}`, league: `liga${i}`, nation: `nasjon${i}` }));
const arsenal = positionsOf.map((position, i) => ({ id: `ars${i}`, position, overall: 80, club: "Arsenal", league: "premier_league", nation: "gb-eng" }));
const squadCards = [...strong, ...arsenal];
const plain = lineupLib.pickBestLineup(squadCards, "4-3-3");
assert.ok(plain.starters.every((id) => id.startsWith("strong")));
const smart = lineupLib.pickBestLineupWithChemistry(squadCards, "4-3-3");
assert.ok(smart.starters.every((id) => id.startsWith("ars")), `kjemilaget velges: ${smart.starters}`);
assert.equal(smart.starters.length, 11);
assert.equal(smart.bench.length, 7);
assert.equal(new Set([...smart.starters, ...smart.bench]).size, 18);
// Uten kjemidata er resultatet det samme som før.
const bare = squadCards.map(({ id, position, overall }) => ({ id, position, overall }));
assert.deepEqual(lineupLib.pickBestLineupWithChemistry(bare, "4-3-3"), lineupLib.pickBestLineup(bare, "4-3-3"));
// Et lite kjemiløft er ikke verdt en mye dårligere spiller.
const weak = positionsOf.map((position, i) => ({ id: `weak${i}`, position, overall: 70, club: "Arsenal", league: "premier_league", nation: "gb-eng" }));
assert.ok(lineupLib.pickBestLineupWithChemistry([...strong, ...weak], "4-3-3").starters.every((id) => id.startsWith("strong")));
// En stor tropp regnes ut raskt, og keeperen er alltid en keeper.
const clubs = ["Arsenal", "Chelsea", "Real Madrid", "Barcelona", "Inter", "Bayern"];
const big = Array.from({ length: 300 }, (_, i) => ({ id: `big${i}`, position: positionsOf[i % 11], overall: 70 + (i % 20), club: clubs[i % 6], league: ["premier_league", "la_liga", "serie_a", "bundesliga"][i % 4], nation: ["gb-eng", "es", "it", "de", "fr"][i % 5] }));
const started = Date.now();
const pickedBig = lineupLib.pickBestLineupWithChemistry(big, "4-3-3");
assert.ok(Date.now() - started < 3000, `for tregt: ${Date.now() - started} ms`);
assert.equal(big.find((card) => card.id === pickedBig.starters[0]).position, "GK");
console.log("Chemistry tests passed");
