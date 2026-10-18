import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Kjører den ekte stadionlogikken uten database eller Next.
const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/stadium.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
new Function("exports", outputText)(exports);
const s = exports;

const now = new Date("2026-10-19T12:00:00Z");
const at = (minutes) => new Date(now.getTime() + minutes * 60_000);
const fresh = () => ({ levels: s.startLevels(), upgrades: [], collectedAt: now });

// Startnivå: klubbhus 1, billettluke 1, ingen tribune.
assert.deepEqual(s.startLevels(), { klubbhus: 1, billettluke: 1, tribune: 0 });

// Første oppgradering av hver bygning.
assert.deepEqual(s.planUpgrade(fresh(), "billettluke", now), { to: 2, cost: 40, minutes: 10, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(fresh(), "tribune", now), { to: 1, cost: 60, minutes: 15, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(fresh(), "klubbhus", now), { to: 2, cost: 300, minutes: 240, minKlubbhus: 1 });

// Klubbhuset setter taket: med klubbhus 1 stopper de andre på nivå 2.
const atCap = { ...fresh(), levels: { klubbhus: 1, billettluke: 2, tribune: 2 } };
assert.deepEqual(s.planUpgrade(atCap, "billettluke", now), { block: "klubbhus_low", to: 3, minKlubbhus: 2 });
assert.deepEqual(s.planUpgrade({ ...atCap, levels: { ...atCap.levels, klubbhus: 2 } }, "billettluke", now), { to: 3, cost: 80, minutes: 30, minKlubbhus: 2 });
assert.equal(s.levelCap("tribune", { klubbhus: 5, billettluke: 1, tribune: 0 }), 10);
assert.equal(s.levelCap("tribune", { klubbhus: 3, billettluke: 1, tribune: 0 }), 6);

// Maks nivå.
assert.deepEqual(s.planUpgrade({ ...fresh(), levels: { klubbhus: 5, billettluke: 10, tribune: 0 } }, "billettluke", now), { block: "max_level" });
assert.deepEqual(s.planUpgrade({ ...fresh(), levels: { klubbhus: 5, billettluke: 1, tribune: 0 } }, "klubbhus", now), { block: "max_level" });

// Én byggher: mens en oppgradering pågår, kan ingen annen starte, og samme bygning er «opptatt».
const building = { ...fresh(), upgrades: [{ building: "billettluke", to: 2, endsAt: at(10) }] };
assert.deepEqual(s.planUpgrade(building, "tribune", now), { block: "builders_busy", to: 1 });
assert.deepEqual(s.planUpgrade(building, "billettluke", now), { block: "busy" });
// Ferdig oppgradering regnes som utført, og byggeren er ledig.
assert.equal(s.effectiveLevels(building, at(10)).billettluke, 2);
assert.equal(s.effectiveLevels(building, at(9)).billettluke, 1);
assert.deepEqual(s.planUpgrade(building, "tribune", at(10)), { to: 1, cost: 60, minutes: 15, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(building, "billettluke", at(10)), { to: 3, block: "klubbhus_low", minKlubbhus: 2 });

// Inntekt: 1 MB i timen på nivå 1, fylt etter 8 timer.
assert.deepEqual(s.incomeOf(s.startLevels()), { perHour: 1, capacity: 8 });
assert.equal(s.collectable(fresh(), at(30)), 0);
assert.equal(s.collectable(fresh(), at(180)), 3);
assert.equal(s.collectable(fresh(), at(60 * 100)), 8);
// Nivå 10: 12 MB i timen, 96 MB lager.
assert.deepEqual(s.incomeOf({ klubbhus: 5, billettluke: 10, tribune: 0 }), { perHour: 12, capacity: 96 });
// Klokka som går bakover gir ingenting.
assert.equal(s.collectable(fresh(), at(-60)), 0);

// Hjemmebanebonus: 0,1 per nivå, aldri over 1.
assert.equal(s.homeBonusOf(s.startLevels()), 0);
assert.equal(s.homeBonusOf({ klubbhus: 1, billettluke: 1, tribune: 3 }), 0.3);
assert.equal(s.homeBonusOf({ klubbhus: 5, billettluke: 1, tribune: 10 }), 1);

// Kostnader og tider stiger for hvert nivå, og hver bygning har riktig antall nivåer.
for (const key of s.buildingKeys) {
  const spec = s.buildings[key];
  assert.equal(spec.costs.length, spec.maxLevel, `${key} costs`);
  assert.equal(spec.minutes.length, spec.maxLevel, `${key} minutes`);
  for (let level = 1; level < spec.maxLevel; level += 1) {
    assert.ok(spec.costs[level] > spec.costs[level - 1], `${key} kostnad stiger ved nivå ${level + 1}`);
    assert.ok(spec.minutes[level] > spec.minutes[level - 1], `${key} tid stiger ved nivå ${level + 1}`);
  }
}
assert.equal(s.hourlyIncome.length, s.buildings.billettluke.maxLevel);

console.log("Stadion: alle sjekker bestått.");
