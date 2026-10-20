import type { UniverseDict } from "../en/universe";

export const universe: UniverseDict = {
  bar: {
    label: (universe: number) => `UNIVERS ${universe}`,
    here: "Du er her",
    viewArchive: (universe: number) => `Univers ${universe}`,
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
    eyebrow: (universe: number) => `UNIVERS ${universe} · LAGRET`,
    title: (club: string) => club,
    readOnlyClosed: "Du har vunnet dette universet. Ligaen er ferdig her, men du kan fortsatt spille draft, åpne pakker, spille mot venner og oppgradere stadion.",
    readOnlyOpen: "Dette er laget og statistikken slik de sto da du forlot universet. Du kan gå tilbake og spille videre.",
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
  league: {
    eyebrow: "LIGAEN ER FERDIG",
    title: (arena: string) => `Du erobret ${arena}`,
    text: "Du har vunnet dette universet, så det er ingen flere ligakamper her. Du kan fortsatt spille draft, åpne pakker, spille mot venner én mot én eller i vennesesong, og oppgradere stadion.",
    links: { draft: "Draft", packs: "Pakker", friends: "Venner", stadium: "Stadion" },
    closedError: "Ligaen er ferdig i dette universet. Du kan fortsatt spille draft, åpne pakker, spille mot venner og oppgradere stadion.",
  },
  switch: {
    button: (universe: number) => `Spill i univers ${universe}`,
    working: "Bytter …",
    busy: "Du kan ikke bytte univers mens en kamp eller draft pågår. Gjør den ferdig først.",
    missing: "Fant ikke universet.",
  },
};
