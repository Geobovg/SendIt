// Leser public/walkouts/*.webm og oppdaterer listen i src/lib/walkout-clips.ts (varighet, og om det finnes en .mov for Safari).
// Kjøres med `npm run walkout:klipp` etter at du har lagt nye klipp i mappen.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// De 20 høyest rangerte kortene etter rating. Endre listen om du heller vil ha andre spillere først.
const wanted = [
  "icon-pele", "icon-maradona", "icon-ronaldo-nazario", "icon-zidane", "icon-cruyff", "icon-beckenbauer", "icon-maldini",
  "icon-ronaldinho", "icon-eusebio", "icon-yashin", "icon-henry", "icon-puskas", "haaland", "icon-gullit", "icon-van-basten",
  "icon-kaka", "mbappe", "rodri", "icon-pirlo", "icon-xavi",
];

const root = join(import.meta.dirname, "..");
const dir = join(root, "public", "walkouts");
const clips = {};
for (const file of readdirSync(dir).filter((name) => name.endsWith(".webm")).sort()) {
  const slug = file.replace(/\.webm$/, "");
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(dir, file)]).toString().trim());
  if (!Number.isFinite(seconds) || seconds < 1) throw new Error(`${file}: ugyldig varighet (${seconds})`);
  clips[slug] = { ms: Math.round(seconds * 1000), mov: existsSync(join(dir, `${slug}.mov`)) };
}

const entries = Object.entries(clips).map(([slug, clip]) => `  ${JSON.stringify(slug)}: { ms: ${clip.ms}, mov: ${clip.mov} },`).join("\n");
const table = `export const walkoutClips: Record<string, WalkoutClip> = {${entries ? `\n${entries}\n` : ""}};`;
const target = join(root, "src", "lib", "walkout-clips.ts");
const source = readFileSync(target, "utf8");
const next = source.replace(/(\/\/ walkout-klipp:start\n)[\s\S]*(\n\/\/ walkout-klipp:slutt)/, `$1${table}$2`);
writeFileSync(target, next);

console.log(`${Object.keys(clips).length} klipp registrert.`);
const missing = wanted.filter((slug) => !clips[slug]);
if (missing.length) console.log(`Mangler klipp for ${missing.length} av de 20 beste: ${missing.join(", ")}`);
const noMov = Object.keys(clips).filter((slug) => !clips[slug].mov);
if (noMov.length) console.log(`Mangler .mov (Safari får sprite-walkouten): ${noMov.join(", ")}`);
