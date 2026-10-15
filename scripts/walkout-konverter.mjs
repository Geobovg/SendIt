// Gjør en video med grønn bakgrunn (f.eks. fra en bilde-til-video-modell) om til et walkout-klipp med
// gjennomsiktig bakgrunn: public/walkouts/<slug>.webm, og oppdaterer listen over klipp.
// Bruk: npm run walkout:konverter -- kilde.mp4 haaland [--key=00ff00] [--likhet=0.14] [--blend=0.06]
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const [source, slug, ...flags] = process.argv.slice(2);
if (!source || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Bruk: npm run walkout:konverter -- <kildevideo> <slug> [--key=00ff00] [--likhet=0.14] [--blend=0.06]");
  process.exit(1);
}
if (!existsSync(source)) {
  console.error(`Finner ikke ${source}`);
  process.exit(1);
}
const flag = (name, fallback) => flags.find((entry) => entry.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const key = flag("key", "00ff00");
const similarity = flag("likhet", "0.14");
const blend = flag("blend", "0.06");

const root = join(import.meta.dirname, "..");
const target = join(root, "public", "walkouts", `${slug}.webm`);
// Nøkkelfargen blir gjennomsiktig og grønnskjæret på kantene fjernes. Videoen skaleres inn i 3:4 (720×960)
// med gjennomsiktig kant, uansett format på kilden.
const filter = [
  `chromakey=0x${key}:${similarity}:${blend}`,
  "despill=type=green",
  "scale=720:960:force_original_aspect_ratio=decrease",
  "format=yuva420p",
  "pad=720:960:(ow-iw)/2:(oh-ih)/2:color=black@0.0",
].join(",");
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", source, "-vf", filter, "-r", "30", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "32", "-an", target], { stdio: "inherit" });

const mb = statSync(target).size / 1e6;
console.log(`${target} (${mb.toFixed(1)} MB)${mb > 2 ? ", over 2 MB: vurder å korte ned klippet eller øke --crf" : ""}`);
execFileSync("node", [join(import.meta.dirname, "walkout-klipp.mjs")], { stdio: "inherit" });
