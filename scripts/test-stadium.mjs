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
const fresh = () => ({ levels: s.startLevels(), upgrades: [], collectedAt: now, xpCollectedAt: now, scout: null });
const withLevels = (levels, extra = {}) => ({ ...fresh(), levels: { ...s.startLevels(), ...levels }, ...extra });
const upgrading = (building, to, minutes, startedMinutes = 0) => ({ building, to, startedAt: at(startedMinutes), endsAt: at(minutes) });

// Alle starter likt: klubbhus 1, billettluke 1, kasse 1 og ingen av de andre.
assert.deepEqual(s.startLevels(), { klubbhus: 1, billettluke: 1, kasse: 1, treningsfelt: 0, tribune: 0, supporterfelt: 0, speiderhytte: 0 });

// Første oppgradering.
assert.deepEqual(s.planUpgrade(fresh(), "billettluke", now), { to: 2, cost: 40, minutes: 10, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(fresh(), "tribune", now), { to: 1, cost: 60, minutes: 15, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(fresh(), "klubbhus", now), { to: 2, cost: 300, minutes: 240, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(fresh(), "speiderhytte", now), { to: 1, cost: 150, minutes: 60, minKlubbhus: 1 });

// Klubbhuset setter taket: med klubbhus 1 stopper de andre på nivå 2.
const atCap = withLevels({ billettluke: 2, tribune: 2 });
assert.deepEqual(s.planUpgrade(atCap, "billettluke", now), { block: "klubbhus_low", to: 3, minKlubbhus: 2 });
assert.deepEqual(s.planUpgrade(withLevels({ klubbhus: 2, billettluke: 2 }), "billettluke", now), { to: 3, cost: 80, minutes: 30, minKlubbhus: 2 });
assert.equal(s.levelCap("tribune", withLevels({ klubbhus: 5 }).levels), 10);
assert.equal(s.levelCap("tribune", withLevels({ klubbhus: 3 }).levels), 6);

// Maks nivå.
assert.deepEqual(s.planUpgrade(withLevels({ klubbhus: 5, billettluke: 10 }), "billettluke", now), { block: "max_level" });
assert.deepEqual(s.planUpgrade(withLevels({ klubbhus: 5 }), "klubbhus", now), { block: "max_level" });

// Byggere, som i Clash: 2 til å begynne med, og én til for hvert klubbhusnivå fra 3, opp til 5.
assert.deepEqual([1, 2, 3, 4, 5].map((level) => s.buildersFor(withLevels({ klubbhus: level }).levels)), [2, 2, 3, 4, 5]);
// Med to byggere kan to ting bygges samtidig, men ikke den samme bygningen to ganger og ikke en tredje.
const busyOne = { ...fresh(), upgrades: [upgrading("billettluke", 2, 10)] };
assert.deepEqual(s.planUpgrade(busyOne, "tribune", now), { to: 1, cost: 60, minutes: 15, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(busyOne, "billettluke", now), { block: "busy" });
const busyTwo = { ...fresh(), upgrades: [upgrading("billettluke", 2, 10), upgrading("kasse", 2, 15)] };
assert.deepEqual(s.planUpgrade(busyTwo, "tribune", now), { block: "builders_busy", to: 1 });
assert.deepEqual(s.planUpgrade(busyTwo, "kasse", now), { block: "busy" });
// Klubbhus 3 gir en tredje byggher, og klubbhus 5 gir fem.
const three = withLevels({ klubbhus: 3 }, { upgrades: busyTwo.upgrades });
assert.deepEqual(s.planUpgrade(three, "tribune", now), { to: 1, cost: 60, minutes: 15, minKlubbhus: 1 });
const threeBusy = { ...three, upgrades: [...three.upgrades, upgrading("tribune", 1, 15)] };
assert.deepEqual(s.planUpgrade(threeBusy, "treningsfelt", now), { block: "builders_busy", to: 1 });
const fiveBusy = withLevels({ klubbhus: 5 }, { upgrades: ["billettluke", "kasse", "tribune", "treningsfelt"].map((key) => upgrading(key, 1, 30)) });
assert.deepEqual(s.planUpgrade(fiveBusy, "supporterfelt", now), { to: 1, cost: 100, minutes: 30, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade({ ...fiveBusy, upgrades: [...fiveBusy.upgrades, upgrading("supporterfelt", 1, 30)] }, "speiderhytte", now), { block: "builders_busy", to: 1 });
// Ferdig oppgradering regnes som utført, og byggeren er ledig.
assert.equal(s.effectiveLevels(busyTwo, at(10)).billettluke, 2);
assert.equal(s.effectiveLevels(busyTwo, at(9)).billettluke, 1);
assert.deepEqual(s.planUpgrade(busyTwo, "tribune", at(10)), { to: 1, cost: 60, minutes: 15, minKlubbhus: 1 });
assert.deepEqual(s.planUpgrade(busyTwo, "billettluke", at(10)), { to: 3, block: "klubbhus_low", minKlubbhus: 2 });

// Dugnad: supporterfeltet kutter 2 % av byggetiden per nivå.
assert.equal(s.buildMinutes(100, withLevels({}).levels), 100);
assert.equal(s.buildMinutes(100, withLevels({ supporterfelt: 5 }).levels), 90);
assert.equal(s.buildMinutes(100, withLevels({ supporterfelt: 10 }).levels), 80);
assert.equal(s.buildMinutes(1, withLevels({ supporterfelt: 10 }).levels), 1);
assert.deepEqual(s.planUpgrade(withLevels({ klubbhus: 2, supporterfelt: 10 }), "billettluke", now), { to: 2, cost: 40, minutes: 8, minKlubbhus: 1 });

// Hurtigbygging: gratis de siste 5 minuttene, ellers 20 MB per time som er igjen.
assert.equal(s.speedupCost(0), 0);
assert.equal(s.speedupCost(300), 0);
assert.equal(s.speedupCost(301), 2);
assert.equal(s.speedupCost(3600), 20);
assert.equal(s.speedupCost(90 * 3600), 1800);

// Billettluka: 1 MB i timen på nivå 1 og kassa rommer 6 timer.
assert.deepEqual(s.incomeOf(s.startLevels()), { perHour: 1, capacity: 6 });
assert.equal(s.collectable(fresh(), at(30)), 0);
assert.equal(s.collectable(fresh(), at(180)), 3);
assert.equal(s.collectable(fresh(), at(60 * 100)), 6);
// Nivå 10 med full tribune: 12 MB i timen + 40 %, og kassa rommer 48 timer.
const maxed = withLevels({ klubbhus: 5, billettluke: 10, kasse: 10, tribune: 10, treningsfelt: 10 }).levels;
assert.deepEqual(s.incomeOf(maxed), { perHour: 16.8, capacity: 806 });
// Tribunen gir prosent mer: +4 % per nivå.
assert.equal(s.incomeOf(withLevels({ tribune: 5 }).levels).perHour, 1.2);
// En større kasse rommer mer, uten å endre farten.
assert.deepEqual(s.incomeOf(withLevels({ kasse: 5 }).levels), { perHour: 1, capacity: 16 });
// Klokka som går bakover gir ingenting.
assert.equal(s.collectable(fresh(), at(-60)), 0);

// Treningsfeltet gir ingenting før det er bygd, og XP etterpå.
assert.deepEqual(s.xpOf(s.startLevels()), { perHour: 0, capacity: 0 });
assert.equal(s.collectable(fresh(), at(600), "xp"), 0);
assert.deepEqual(s.xpOf(maxed), { perHour: 15, capacity: 720 });
const trained = withLevels({ treningsfelt: 3 });
assert.equal(s.collectable(trained, at(120), "xp"), 6);
// MB og XP har hver sin klokke.
assert.equal(s.collectable({ ...trained, xpCollectedAt: at(100) }, at(110), "xp"), 0);
assert.equal(s.collectable({ ...trained, xpCollectedAt: at(100) }, at(120), "mb"), 2);

// Speideren: rating og pakke etter nivå, ingenting uten hytte.
assert.equal(s.scoutReward(0), null);
assert.deepEqual(s.scoutReward(1), { minOverall: 87, maxOverall: 87, packKey: "premium_gull" });
assert.deepEqual(s.scoutReward(5), { minOverall: 88, maxOverall: 89, packKey: "jumbo_premium_gull" });
assert.deepEqual(s.scoutReward(10), { minOverall: 92, maxOverall: 94, packKey: "formpakka" });
assert.deepEqual(s.scoutReward(99), s.scoutReward(10));
// Prisen er 60 % av katalogprisen, og dyrere jo høyere rating.
assert.equal(s.scoutPrice(280), 168);
assert.equal(s.scoutPrice(2000), 1200);
assert.equal(s.scoutPrice(1), 1);
// Speiderens gang: ute, hjemme uten forslag, og hjemme med forslag.
const out = { ...fresh(), scout: { level: 1, startedAt: now, endsAt: at(1440), offer: null } };
assert.equal(s.scoutStatus(fresh(), now), "none");
assert.equal(s.scoutStatus(out, at(10)), "away");
assert.equal(s.scoutStatus(out, at(1440)), "back");
assert.equal(s.scoutStatus({ ...out, scout: { ...out.scout, offer: { player: null, packKey: "premium_gull" } } }, at(1440)), "offer");

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
for (const table of [s.hourlyIncome, s.hourlyXp, s.storageHours]) assert.equal(table.length, 10);
for (let level = 1; level <= 10; level += 1) {
  const reward = s.scoutReward(level);
  assert.ok(reward.minOverall >= 87 && reward.maxOverall <= 94 && reward.minOverall <= reward.maxOverall, `speider ${level} rating`);
  if (level > 1) assert.ok(s.scoutReward(level).maxOverall >= s.scoutReward(level - 1).maxOverall, `speider ${level} blir ikke dårligere`);
}

// Kapasiteten på stadionet vokser med tribunen og er bare pynt (ingen virkning i spillet).
assert.equal(s.seatCapacities.length, s.buildings.tribune.maxLevel + 1);
for (let level = 1; level <= s.buildings.tribune.maxLevel; level += 1) assert.ok(s.seatCapacities[level] > s.seatCapacities[level - 1], `kapasitet stiger ved tribunenivå ${level}`);
assert.equal(s.seatsOf(s.startLevels()), 200);
assert.equal(s.seatsOf({ ...s.startLevels(), tribune: 10 }), 80_000);

console.log("Stadion: alle sjekker bestått.");
