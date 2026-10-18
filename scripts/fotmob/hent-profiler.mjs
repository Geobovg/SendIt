// Henter spillerprofilene fra FotMob for alle koblede katalogspillere (data/match.json) og lagrer et utdrag i data/profiler.json.
// Bruk: node scripts/fotmob/hent-profiler.mjs   (kan avbrytes og startes på nytt, ferdig hentede sider ligger i cachen)
import { readFileSync, writeFileSync } from "node:fs";
import { hentSide } from "./fotmob.mjs";

const match = JSON.parse(readFileSync(new URL("./data/match.json", import.meta.url), "utf8"));
const sikre = match.filter((r) => r.fotmobId && !/^(flere|usikker)/.test(r.art));
// Høyest rating først, så de viktigste er ferdige først hvis vi må avbryte
sikre.sort((a, b) => b.overall - a.overall);

const info = (p, nokkel) => p.playerInformation?.find((i) => i.translationKey === nokkel)?.value;
const profiler = {};
let n = 0;
for (const r of sikre) {
  n++;
  try {
    const { sideData, fraCache } = await hentSide(`/players/${r.fotmobId}/x`, `spiller-${r.fotmobId}`, { forsinkelse: 1500 });
    const p = sideData.fallback?.[`player:${r.fotmobId}`] ?? sideData.data;
    if (!p) throw new Error("ingen spillerdata");
    const verdier = p.marketValues?.values ?? [];
    const sist = verdier.at(-1);
    const stat = (navn) => p.mainLeague?.stats?.find((s) => s.localizedTitleId === navn)?.value;
    profiler[r.slug] = {
      fotmobId: r.fotmobId,
      name: p.name,
      team: p.primaryTeam?.teamName,
      position: p.positionDescription?.primaryPosition?.label,
      positions: p.positionDescription?.positions?.map((x) => ({ pos: x.strPosShort?.label, kamper: x.occurences })),
      born: p.birthDate?.utcTime,
      height: info(p, "height_sentencecase")?.numberValue,
      foot: info(p, "preferred_foot")?.fallback,
      shirt: info(p, "shirt")?.numberValue,
      country: info(p, "country")?.fallback,
      contractEnd: p.contractEnd?.utcTime,
      marketValueEur: sist?.value ?? null,
      marketValueDate: sist?.date ?? null,
      marketValuePeakEur: verdier.length ? Math.max(...verdier.map((v) => v.value)) : null,
      league: p.mainLeague?.leagueName,
      season: p.mainLeague?.season,
      leagueStats: p.mainLeague?.stats?.map((s) => ({ key: s.localizedTitleId, value: s.value })),
      traits: p.traits?.items?.map((t) => ({ key: t.key, value: t.value })),
      traitsTitle: p.traits?.title,
      injury: p.injuryInformation ?? null,
      trophies: p.trophies ? Object.keys(p.trophies).length : 0,
    };
    if (n % 25 === 0 || !fraCache) process.stdout.write(`${n}/${sikre.length} ${r.name}\n`);
  } catch (e) {
    console.log(`${n}/${sikre.length} ${r.name}: FEIL ${e.message}`);
  }
  if (n % 50 === 0) writeFileSync(new URL("./data/profiler.json", import.meta.url), JSON.stringify(profiler));
}
writeFileSync(new URL("./data/profiler.json", import.meta.url), JSON.stringify(profiler));
console.log(`Ferdig: ${Object.keys(profiler).length} profiler`);
