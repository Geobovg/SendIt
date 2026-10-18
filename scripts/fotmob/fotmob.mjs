// Felles hjelpere: henter FotMob-sider (med cache på disk) og tar ut __NEXT_DATA__.
// FotMob har ikke noe åpent API, så vi leser dataene som ligger i selve sidene. Vær snill mot serveren:
// pause mellom kall, og alt caches i data/cache slik at vi aldri henter det samme to ganger.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const cache = new URL("./data/cache/", import.meta.url);
mkdirSync(cache, { recursive: true });

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Henter siden som tekst. `nokkel` er filnavnet i cachen. Returnerer { sideData, fraCache }. */
export async function hentSide(sti, nokkel, { forsinkelse = 1200 } = {}) {
  const fil = new URL(`${nokkel}.json`, cache);
  if (existsSync(fil)) return { sideData: JSON.parse(readFileSync(fil, "utf8")), fraCache: true };
  await pause(forsinkelse);
  let html = "";
  for (let forsok = 1; forsok <= 3; forsok++) {
    try {
      html = execFileSync("curl", ["-sS", "-m", "40", "-A", UA, "-w", "\n%{http_code}", `https://www.fotmob.com${sti}`], { maxBuffer: 64 * 1024 * 1024 }).toString();
      const kode = html.slice(html.lastIndexOf("\n") + 1);
      if (kode === "200") break;
      if (forsok === 3) throw new Error(`HTTP ${kode} for ${sti}`);
    } catch (e) {
      if (forsok === 3) throw e;
    }
    await pause(3000 * forsok);
  }
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!m) throw new Error(`Fant ikke __NEXT_DATA__ for ${sti}`);
  const props = JSON.parse(m[1]).props.pageProps;
  // Oversettelsene er store og like på alle sider
  delete props.translations;
  if (props.fallback) delete props.fallback["/api/translationmapping?locale=en"];
  writeFileSync(fil, JSON.stringify(props));
  return { sideData: props, fraCache: false };
}

/** Navn uten aksenter, tegnsetting og store bokstaver, til sammenligning. */
export function normaliser(navn) {
  return navn
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/ß/g, "ss").replace(/ł/gi, "l").replace(/đ/gi, "d")
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
