import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Kjører de ekte TypeScript-modulene uten databaseavhengigheter (som test-draft-generation.mjs).
const modules = new Map();
function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  modules.set(url.href, exports);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const localRequire = (specifier) => {
    if (specifier.startsWith(".")) { const file = new URL(specifier.endsWith(".ts") ? specifier : `${specifier}.ts`, url); return load(file); }
    return import.meta.resolve ? {} : {};
  };
  new Function("exports", "require", outputText)(exports, localRequire);
  return exports;
}

const { canPlayPosition, cardCanPlay, cardPositions, positionInSlot, pickBestLineup } = load(new URL("../src/lib/lineup.ts", import.meta.url));

// Kimmich: CDM med CM og RB som alternativ
const kimmich = { id: "k", position: "CDM", altPositions: ["CM", "RB"], overall: 88 };
assert.equal(cardCanPlay(kimmich, "RB"), true);
assert.equal(cardCanPlay(kimmich, "CM"), true);
assert.equal(cardCanPlay(kimmich, "LB"), false);
assert.equal(cardCanPlay(kimmich, "ST"), false);
assert.deepEqual(cardPositions(kimmich), ["CDM", "CM", "RB"]);
// Mbappé: ST med LW og RW
const mbappe = { id: "m", position: "ST", altPositions: ["LW", "RW"], overall: 91 };
assert.equal(cardCanPlay(mbappe, "RW"), true);
assert.equal(cardCanPlay(mbappe, "LW"), true);
assert.equal(cardCanPlay(mbappe, "CAM"), false);
// Balde: LB med RB
const balde = { id: "b", position: "LB", altPositions: ["RB"], overall: 82 };
assert.equal(cardCanPlay(balde, "RB"), true);
assert.equal(cardCanPlay(balde, "CB"), false);
// Uten alternative posisjoner er alt som før
assert.equal(canPlayPosition("CB", "RB"), false);
assert.equal(canPlayPosition("CDM", "CAM"), true);
assert.equal(canPlayPosition("ALL", "GK"), true);
// På en alternativ posisjon spiller kortet den posisjonen i kampen
assert.equal(positionInSlot(kimmich, "RB").position, "RB");
assert.equal(positionInSlot(kimmich, "CM").position, "CDM");
assert.equal(positionInSlot(mbappe, "ST").position, "ST");
assert.equal(positionInSlot({ id: "x", position: "CB", overall: 70 }, "LB").position, "CB");

// Beste ellever: en midtbanespiller som også kan spille back, tar ikke plassen til en ekte back som er like god
const squad = [
  { id: "gk", position: "GK", overall: 80 }, { id: "lb", position: "LB", overall: 75 }, { id: "cb1", position: "CB", overall: 78 }, { id: "cb2", position: "CB", overall: 77 },
  { id: "rb", position: "RB", overall: 75 }, kimmich, { id: "cm1", position: "CM", overall: 80 }, { id: "cm2", position: "CM", overall: 79 },
  { id: "lw", position: "LW", overall: 80 }, mbappe, { id: "rw", position: "RW", overall: 80 }, { id: "sub", position: "ST", overall: 60 },
];
const { starters } = pickBestLineup(squad, "4-3-3");
assert.ok(starters.includes("rb"), "ekte RB spiller når han er like god som han som kan spille RB");
assert.ok(starters.includes("k") && starters.includes("m"));

// Mangler en ekte høyreback, kan Kimmich fylle plassen
const noRb = squad.filter((card) => card.id !== "rb");
const noRbLineup = pickBestLineup(noRb, "4-3-3");
assert.equal(noRbLineup.starters.length, 11);
assert.ok(noRbLineup.starters.includes("k"));
console.log("alt-positions OK");
