import type { UniverseDict } from "../en/universe";

export const universe: UniverseDict = {
  bar: {
    label: (universe: number) => `UNIVERS ${universe}`,
    here: "Du er her",
    viewArchive: (universe: number) => `Univers ${universe} (arkiv)`,
  },
  transition: {
    eyebrow: "UNIVERSETS MESTER",
    headline: (arena: string) => `Du erobret ${arena}`,
    saving: (universe: number) => `Univers ${universe} er fullført. Laget og statistikken din er lagret i arkivet.`,
    travelling: (universe: number) => `Reiser til univers ${universe} …`,
    freshStart: (universe: number, arena: string, division: number) => `Univers ${universe}: en ny start i divisjon ${division}, ${arena}.`,
    keeps: "Klubbnivået, vennene og profilen din følger med. Laget, MB-en og stadionet starter på nytt.",
    button: (universe: number) => `Gå inn i univers ${universe}`,
  },
  archive: {
    eyebrow: (universe: number) => `UNIVERS ${universe} · ARKIV`,
    title: (club: string) => club,
    readOnly: "Dette universet er lukket. Du kan se laget og statistikken, men ikke spille flere kamper her.",
    back: "Tilbake til universet ditt",
    stats: { rating: "Lagrating", record: "Seiere / uavgjort / tap", cards: "Kort", earned: "MB tjent", formation: "Formasjon", xp: "Klubb-XP" },
    seasons: "Sesonger",
    season: (number: number) => `Sesong ${number}`,
    position: (position: number | null) => position ? `#${position}` : "–",
    outcome: { promoted: "Rykket opp", relegated: "Rykket ned", stayed: "Ble stående", champion: "Mester" },
    starters: "Startellever",
    bench: "Benk",
    notFound: "Du har ikke noe arkiv for dette universet.",
  },
};
