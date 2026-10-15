import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Prosenten som står på ruta skal være nøyaktig sjansen utfallet trekkes mot – for skytter og keeper,
// i managerkarriere og femmer. Hvert tilfelle spilles mange ganger og sammenlignes med tallet.
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
const manager = load(new URL("../src/lib/manager-match.ts", import.meta.url));
const five = load(new URL("../src/lib/femmer/match.ts", import.meta.url));

const RUNS = 60_000;
// Fire standardavvik ved 50 %, så testen ikke feiler på flaks.
const TOLERANCE = 4 * Math.sqrt(0.25 / RUNS);
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < TOLERANCE, `${label}: viser ${(expected * 100).toFixed(1)} %, ble ${(actual * 100).toFixed(1)} %`);
const rate = (run) => { let hits = 0; for (let i = 0; i < RUNS; i += 1) if (run(i)) hits += 1; return hits / RUNS; };
let checks = 0;

// --- Managerkarriere ---
for (const shooting of [58, 75, 92]) {
  const options = manager.shotOptions(shooting);
  for (const keeper of [55, 80]) {
    for (const kind of ["chance", "penalty"]) {
      const shot = { minute: 30, side: "home", kind, options, keeperId: "gk" };
      for (const cell of options) {
        // Skytter mot AI-keeper: én trekning mot tallet på ruta.
        const shown = manager.shotGoalChance(shot, shooting, cell, keeper, false);
        close(rate(() => manager.resolveShot(shot, shooting, keeper, cell, null, Math.random(), Math.random()).outcome === "goal"), shown, `${kind} ${shooting} mot ${keeper}, rute ${cell}`);
        checks += 1;
      }
    }
    // Straffe mot en manager i mål. Keeperen som ikke rakk å velge, kaster seg jevnt blant rutene.
    const penalty = { minute: 30, side: "home", kind: "penalty", options, keeperId: "gk" };
    for (const cell of options) {
      const shown = manager.shotGoalChance(penalty, shooting, cell, keeper, true);
      close(rate((i) => manager.resolveShot(penalty, shooting, keeper, cell, manager.autoShotCell(`m${i}`, penalty, "keeper"), Math.random(), Math.random()).outcome === "goal"), shown, `straffe mot manager, rute ${cell}`);
      // Manager i mål mot en AI-skytter (eller en som ikke rakk å velge).
      const save = manager.penaltySaveChance(penalty, cell);
      close(rate((i) => manager.resolveShot(penalty, shooting, keeper, manager.autoShotCell(`m${i}`, penalty, "shooter"), cell, Math.random(), Math.random()).outcome === "saved"), save, `redning i rute ${cell}`);
      checks += 2;
    }
  }
}

// --- Femmer ---
for (const [shooting, keeping] of [[55, 80], [75, 75], [92, 60]]) {
  for (const kind of ["chance", "penalty"]) {
    const shot = { minute: 10, side: "home", kind, takerId: "a", taker: "A", shooting, keeperId: "k", keeper: "K", keeping };
    for (let cell = 0; cell < five.FIVE_SHOT_CELLS; cell += 1) {
      const goal = five.fiveCellChance(shot, cell);
      close(rate(() => five.resolveFiveShot({ controllerSide: "home" }, shot, cell, [Math.random(), Math.random(), Math.random()]).outcome === "goal"), goal, `femmer skytter ${kind} rute ${cell}`);
      const stop = five.fiveKeeperStopChance(shot, cell);
      close(rate(() => five.resolveFiveShot({ controllerSide: "away" }, shot, cell, [Math.random(), Math.random(), Math.random()]).outcome !== "goal"), stop, `femmer keeper ${kind} rute ${cell}`);
      checks += 2;
    }
  }
}

console.log(`OK – ${checks} prosenter stemmer med utfallene (±${(TOLERANCE * 100).toFixed(1)} prosentpoeng).`);
