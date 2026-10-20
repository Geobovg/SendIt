// Universer: vinner du divisjon 1 på Camp Nou, starter du på nytt i et nytt univers (migrering 0128).
export const universe = {
  bar: {
    label: (universe: number) => `UNIVERSE ${universe}`,
    here: "You are here",
    viewArchive: (universe: number) => `Universe ${universe} (archive)`,
  },
  transition: {
    eyebrow: "MASTER OF THE UNIVERSE",
    headline: (arena: string) => `You conquered ${arena}`,
    saving: (universe: number) => `Universe ${universe} is complete. Your squad and stats are saved in the archive.`,
    travelling: (universe: number) => `Travelling to universe ${universe}…`,
    freshStart: (universe: number, arena: string, division: number) => `Universe ${universe}: a fresh start in division ${division}, ${arena}.`,
    keeps: "Your club level, friends and profile come with you. The squad, coins and stadium start over.",
    button: (universe: number) => `Enter universe ${universe}`,
  },
  archive: {
    eyebrow: (universe: number) => `UNIVERSE ${universe} · ARCHIVE`,
    title: (club: string) => club,
    readOnly: "This universe is closed. You can look at the squad and the stats, but no more matches can be played here.",
    back: "Back to the current universe",
    stats: { rating: "Squad rating", record: "Wins / draws / losses", cards: "Cards", earned: "Coins earned", formation: "Formation", xp: "Club XP" },
    seasons: "Seasons",
    season: (number: number) => `Season ${number}`,
    position: (position: number | null) => position ? `#${position}` : "–",
    outcome: { promoted: "Promoted", relegated: "Relegated", stayed: "Stayed", champion: "Champion" },
    starters: "Starting XI",
    bench: "Bench",
    notFound: "You have no archive for this universe.",
  },
};

export type UniverseDict = typeof universe;
