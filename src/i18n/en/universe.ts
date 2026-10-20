// Universer: vinner du divisjon 1 på Camp Nou, starter du på nytt i et nytt univers (migrering 0128). Du kan bytte tilbake og spille videre i dem (migrering 0129).
export const universe = {
  bar: {
    label: (universe: number) => `UNIVERSE ${universe}`,
    here: "You are here",
    viewArchive: (universe: number) => `Universe ${universe}`,
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
    eyebrow: (universe: number) => `UNIVERSE ${universe} · SAVED`,
    title: (club: string) => club,
    readOnlyClosed: "You won this universe. The league is over here, but you can still play drafts, open packs, play friends and upgrade your stadium.",
    readOnlyOpen: "This is the squad and the stats as they were when you left this universe. You can go back and keep playing.",
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
  // Et univers der Camp Nou er vunnet: ligaen er ferdig, men alt annet kan spilles.
  league: {
    eyebrow: "LEAGUE COMPLETE",
    title: (arena: string) => `You conquered ${arena}`,
    text: "You won this universe, so there are no more league matches here. You can still play drafts, open packs, play friends one-on-one or in a friend season, and upgrade your stadium.",
    links: { draft: "Draft", packs: "Packs", friends: "Friends", stadium: "Stadium" },
    closedError: "The league is over in this universe. You can still play drafts, open packs, play friends and upgrade your stadium.",
  },
  switch: {
    button: (universe: number) => `Play in universe ${universe}`,
    working: "Switching…",
    busy: "You can't switch universe while a match or draft is in progress. Finish it first.",
    missing: "Could not find that universe.",
  },
};

export type UniverseDict = typeof universe;
