import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute the real TypeScript modules without importing server-only database dependencies.
const modules = new Map();
function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  modules.set(url.href, exports);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const require = (name) => {
    assert.ok(name.startsWith("./"), `Unexpected dependency: ${name}`);
    return load(new URL(`${name}.ts`, url));
  };
  new Function("require", "exports", outputText)(require, exports);
  return exports;
}
const core = load(new URL("../src/lib/draft-core.ts", import.meta.url));
const { formations, formationNames, canPlayPosition } = load(new URL("../src/lib/lineup.ts", import.meta.url));
const { drawOptions, aiDraftTeam, takenKeys, isTaken } = load(new URL("../src/lib/draft-generation.ts", import.meta.url));
const positions = ["GK", "CB", "LB", "LWB", "RB", "RWB", "CDM", "CM", "CAM", "LW", "RW", "LM", "RM", "ST", "SA"];
const normal = positions.flatMap((position) => Array.from({ length: 20 }, (_, index) => ({
  catalogId: `${position}-${index}`, name: `${position} ${index}`, position, overall: 75 + index,
  attributes: {}, special: null,
})));
const pool = { normal, special: normal.filter((card) => card.overall >= 85).map((card) => ({ ...card, special: "inform" })) };
const random = Math.random;
try {
  for (let seed = 1; seed <= 10; seed++) {
    let state = seed;
    Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
    for (const formation of formationNames) {
      const players = {};
      const taken = new Set();
      const captainOptions = drawOptions(pool, core.CAPTAIN_KEY, formation, taken);
      assert.equal(captainOptions.length, 5);
      assert.ok(captainOptions.every((card) => card.overall >= 85));
      const captain = captainOptions[0];
      const captainSlot = core.captainSlot(formation, players, captain.position);
      assert.ok(captainSlot);
      players[captainSlot] = captain;
      taken.add(captain.catalogId);
      for (const key of core.ALL_SLOT_KEYS.filter((key) => key !== captainSlot)) {
        const options = drawOptions(pool, key, formation, taken);
        assert.equal(options.length, 5, `${formation} ${key}`);
        assert.equal(new Set(options.map((card) => card.catalogId)).size, 5);
        assert.ok(options.every((card) => !taken.has(card.catalogId) && core.slotAccepts(key, formation, card.position)));
        players[key] = options[0];
        taken.add(options[0].catalogId);
      }
      assert.equal(core.draftComplete(players), true);
      assert.equal(taken.size, 23);
      const team = core.draftTeamSnapshot("manager", formation, players);
      assert.equal(team.starters.length, 11);
      assert.equal(team.bench.length, 7);
      assert.equal(new Set([...team.starters, ...team.bench].map((card) => card.id)).size, 18);
      assert.ok(team.starters.every((card, index) => canPlayPosition(card.position, formations[formation][index].position)));
      const ai = aiDraftTeam(pool, 85, new Set());
      assert.equal(ai.team.starters.length, 11);
      assert.equal(ai.team.bench.length, 7);
      assert.ok(ai.team.starters.every((card, index) => canPlayPosition(card.position, formations[ai.team.formation][index].position)));
    }
  }
  assert.deepEqual(core.draftReward(175, null, "sjeldne_spillere", 0), {mb:175,packs:[{key:"sjeldne_spillere",quantity:1}],tokens:0});
  assert.deepEqual(core.draftReward(10, [{key:"gullpakke",quantity:2}], "old-pack", 1), {mb:10,packs:[{key:"gullpakke",quantity:2}],tokens:1});
  assert.equal(core.slotAccepts("b4", "4-3-3", "LM"), true);
  assert.equal(core.slotAccepts("b2", "4-3-3", "RWB"), true);
  assert.equal(core.slotAccepts("b5", "4-3-3", "SA"), true);
  // Samme spiller under to katalog-id-er (og med aksent i navnet) regnes som én spiller.
  const twins = { normal: [
    { catalogId: "a", name: "Vinícius Júnior", position: "LW", overall: 90, attributes: {}, special: null },
    { catalogId: "b", name: "Vinicius Junior", position: "LW", overall: 89, attributes: {}, special: null },
    { catalogId: "c", name: "Annen Spiller", position: "LW", overall: 80, attributes: {}, special: null },
  ], special: [] };
  const withTwin = takenKeys([twins.normal[0]]);
  assert.equal(isTaken(withTwin, twins.normal[1]), true);
  assert.equal(isTaken(withTwin, twins.normal[2]), false);
  for (let run = 0; run < 50; run++) {
    const names = drawOptions(twins, "captain", "4-3-3", new Set()).map((card) => card.catalogId);
    assert.ok(!(names.includes("a") && names.includes("b")), "samme spiller to ganger i ett valg");
    assert.deepEqual(drawOptions(twins, "captain", "4-3-3", withTwin).map((card) => card.catalogId), ["c"]);
  }
  assert.deepEqual(drawOptions({normal: [], special: []}, "s0", "4-3-3", new Set()), []);
  assert.throws(() => aiDraftTeam({normal: []}, 85, new Set()), /eleven players/);
  assert.equal(core.draftTeamSnapshot("manager", "4-3-3", {}), null);
} finally {
  Math.random = random;
}
console.log("Draft generation passed: 50 complete squads across all five formations, with AI teams and duplicate checks.");
