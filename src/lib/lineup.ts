import { chemistryOf, RATING_PER_CHEMISTRY, type ChemistryPlayer } from "./chemistry";

export type Formation = "4-3-3" | "4-2-3-1" | "4-4-2" | "3-5-2" | "4-3-1-2";

export type FormationSlot = { position: string; x: number; y: number };

export const formations: Record<Formation, FormationSlot[]> = {
  "4-3-3": [
    { position: "GK", x: 50, y: 93 }, { position: "LB", x: 15, y: 74 }, { position: "CB", x: 38, y: 78 }, { position: "CB", x: 62, y: 78 }, { position: "RB", x: 85, y: 74 },
    { position: "CM", x: 26, y: 55 }, { position: "CM", x: 50, y: 59 }, { position: "CM", x: 74, y: 55 }, { position: "LW", x: 18, y: 30 }, { position: "ST", x: 50, y: 20 }, { position: "RW", x: 82, y: 30 },
  ],
  "4-2-3-1": [
    { position: "GK", x: 50, y: 93 }, { position: "LB", x: 15, y: 74 }, { position: "CB", x: 38, y: 78 }, { position: "CB", x: 62, y: 78 }, { position: "RB", x: 85, y: 74 },
    { position: "CDM", x: 35, y: 59 }, { position: "CDM", x: 65, y: 59 }, { position: "LW", x: 18, y: 40 }, { position: "CAM", x: 50, y: 42 }, { position: "RW", x: 82, y: 40 }, { position: "ST", x: 50, y: 17 },
  ],
  "4-4-2": [
    { position: "GK", x: 50, y: 93 }, { position: "LB", x: 15, y: 74 }, { position: "CB", x: 38, y: 78 }, { position: "CB", x: 62, y: 78 }, { position: "RB", x: 85, y: 74 },
    { position: "LM", x: 15, y: 50 }, { position: "CM", x: 38, y: 56 }, { position: "CM", x: 62, y: 56 }, { position: "RM", x: 85, y: 50 }, { position: "ST", x: 36, y: 25 }, { position: "ST", x: 64, y: 25 },
  ],
  "3-5-2": [
    { position: "GK", x: 50, y: 93 }, { position: "CB", x: 28, y: 77 }, { position: "CB", x: 50, y: 76 }, { position: "CB", x: 72, y: 77 },
    { position: "LM", x: 12, y: 54 }, { position: "CM", x: 32, y: 56 }, { position: "CDM", x: 50, y: 57 }, { position: "CM", x: 68, y: 56 }, { position: "RM", x: 88, y: 54 }, { position: "ST", x: 36, y: 25 }, { position: "ST", x: 64, y: 25 },
  ],
  "4-3-1-2": [
    { position: "GK", x: 50, y: 93 }, { position: "LB", x: 15, y: 74 }, { position: "CB", x: 38, y: 78 }, { position: "CB", x: 62, y: 78 }, { position: "RB", x: 85, y: 74 },
    { position: "CM", x: 26, y: 57 }, { position: "CM", x: 50, y: 63 }, { position: "CM", x: 74, y: 57 }, { position: "CAM", x: 50, y: 41 }, { position: "ST", x: 34, y: 23 }, { position: "ST", x: 66, y: 23 },
  ],
};

export const formationNames = Object.keys(formations) as Formation[];

const positionGroups = [
  ["GK"], ["CB"], ["LB", "LWB"], ["RB", "RWB"], ["CDM", "CM", "CAM"], ["LW", "RW", "LM", "RM"], ["ST", "SA"],
];

// Personlige kort (migrering 0063) har denne posisjonen og kan spille hvor som helst.
export const anyPosition = "ALL";

// `altPositions` er de andre posisjonene spilleren også spiller i virkeligheten (migrering 0109). De teller som
// hovedposisjonen, så Kimmich (CDM, alt CM/RB) kan stå som høyreback uten straff.
export function canPlayPosition(naturalPosition: string, targetPosition: string, altPositions: readonly string[] = []) {
  return naturalPosition === anyPosition || [naturalPosition, ...altPositions].some((position) => positionGroups.some((group) => group.includes(position) && group.includes(targetPosition)));
}

/** Alle posisjonene kortet er oppført med: hovedposisjonen først, så de alternative. */
export function cardPositions(card: { position: string; altPositions?: readonly string[] }): string[] {
  return [card.position, ...(card.altPositions ?? []).filter((position) => position !== card.position)];
}

/** Som `canPlayPosition`, men for et helt kort. */
export function cardCanPlay(card: { position: string; altPositions?: readonly string[] }, targetPosition: string) {
  return canPlayPosition(card.position, targetPosition, card.altPositions);
}

/** Posisjonen kortet spiller på plassen sin: en spiller som står på en alternativ posisjon, spiller den (som et kort som kan alt). */
export function positionInSlot<T extends { position: string; altPositions?: readonly string[] }>(card: T, slotPosition: string): T {
  if (card.position === slotPosition || (card.position !== anyPosition && canPlayPosition(card.position, slotPosition))) return card;
  return cardCanPlay(card, slotPosition) ? { ...card, position: slotPosition } : card;
}

type SelectableCard = { id: string; position: string; overall: number; altPositions?: readonly string[] };

// Fyller plassene fra puljene i rekkefølge. I hver pulje får kortene med fast posisjon velge først,
// så et kort som kan spille alt ikke tar keeperplassen fra keeperen. Det settes inn der det trengs etterpå.
function fillSlots<T extends SelectableCard>(slots: FormationSlot[], pools: T[][]) {
  const lineup: (T | null)[] = slots.map(() => null);
  const left = pools.map((pool) => [...pool]);
  for (const pool of left) {
    // Først kortene som passer med hovedposisjonen, så de som bare passer med en alternativ posisjon
    // (en midtbanespiller som også kan spille back, tar ikke backplassen fra en ekte back), til slutt de som kan alt.
    for (const pass of ["primary", "alternative", "versatile"] as const) {
      slots.forEach((slot, index) => {
        if (lineup[index]) return;
        const matchIndex = pool.findIndex((card) => {
          if (pass === "versatile") return card.position === anyPosition;
          if (card.position === anyPosition) return false;
          return pass === "primary" ? canPlayPosition(card.position, slot.position) : cardCanPlay(card, slot.position);
        });
        if (matchIndex >= 0) lineup[index] = pool.splice(matchIndex, 1)[0];
      });
    }
  }
  // Ingen kort passer: da står beste ledige kort der likevel, som før.
  const rest = left.flat();
  lineup.forEach((card, index) => { if (!card && rest.length) lineup[index] = rest.shift()!; });
  return { lineup, rest };
}

export function pickBestLineup<T extends SelectableCard>(cards: T[], formation: Formation) {
  const sorted = [...cards].sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const slots = formations[formation];
  const { lineup, rest } = fillSlots(slots, [sorted.filter((card) => card.position !== anyPosition)]);
  // Kort som kan spille alt, tar plassen til den svakeste i elleveren (eller en som står feil) når det er bedre.
  // En keeper som står i mål, byttes ikke ut automatisk; vil man ha kortet i mål, kan man flytte det dit selv.
  const strength = (card: T | null, index: number) => (!card || !cardCanPlay(card, slots[index].position) ? -1 : slots[index].position === "GK" ? Infinity : card.overall);
  for (const versatile of sorted.filter((card) => card.position === anyPosition)) {
    const weakest = lineup.reduce((best, card, index) => (strength(card, index) < strength(lineup[best], best) ? index : best), 0);
    if (versatile.overall > strength(lineup[weakest], weakest)) {
      const replaced = lineup[weakest];
      lineup[weakest] = versatile;
      if (replaced) rest.push(replaced);
    } else rest.push(versatile);
  }
  rest.sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  return { starters: lineup.filter((card): card is T => Boolean(card)).map((card) => card.id), bench: rest.slice(0, 7).map((card) => card.id) };
}

/**
 * Som `pickBestLineup`, men med kjemi: elleveren som gir høyest rating pluss kjemi (+1 per kjemipoeng, som i kampmotoren).
 * Starter fra elleveren med best rating og fra elleveren som bygger rundt de største klubbene, ligaene og nasjonene
 * blant kortene, og bytter inn kort så lenge det gir mer. Har ingen kort kjemi, blir resultatet det samme som før.
 */
export function pickBestLineupWithChemistry<T extends SelectableCard & ChemistryPlayer>(cards: T[], formation: Formation) {
  const base = pickBestLineup(cards, formation);
  const byId = new Map(cards.map((card) => [card.id, card]));
  const slots = formations[formation];
  if (base.starters.length !== 11 || !cards.some((card) => card.club || card.league || card.nation || card.personal)) return base;

  const worth = (lineup: T[]) => {
    const points = chemistryOf(lineup);
    return lineup.reduce((sum, card, index) => sum + (cardCanPlay(card, slots[index].position) ? card.overall : 0) + (points.get(card.id) ?? 0) * RATING_PER_CHEMISTRY, 0);
  };
  const climb = (start: T[]) => {
    const lineup = [...start];
    let best = worth(lineup);
    for (let round = 0; round < 25; round += 1) {
      let move: { index: number; card: T; value: number } | null = null;
      const inLineup = new Set(lineup.map((card) => card.id));
      for (let index = 0; index < lineup.length; index += 1) {
        for (const card of cards) {
          if (inLineup.has(card.id) || !cardCanPlay(card, slots[index].position)) continue;
          // Keeperen byttes bare mot en annen keeper; et kort som kan spille alt, tar aldri keeperplassen.
          if (slots[index].position === "GK" && card.position !== "GK") continue;
          const value = worth([...lineup.slice(0, index), card, ...lineup.slice(index + 1)]);
          if (value > best + 1e-9 && (!move || value > move.value)) move = { index, card, value };
        }
      }
      if (!move) break;
      lineup[move.index] = move.card;
      best = move.value;
    }
    return { lineup, value: best };
  };

  const fixed = cards.filter((card) => card.position !== anyPosition);
  const groups = new Map<string, T[]>();
  for (const card of fixed) {
    const keys = [card.club && `club:${card.club}`, card.league && card.league !== "other" && `league:${card.league}`, card.nation && `nation:${card.nation}`];
    for (const key of keys) if (key) groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  const seeds: T[][] = [base.starters.map((id) => byId.get(id)!)];
  const bigGroups = [...groups.values()].filter((group) => group.length >= 3).sort((a, b) => b.length - a.length).slice(0, 10);
  for (const group of bigGroups) {
    const ids = new Set(group.map((card) => card.id));
    const ordered = [...cards].sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)) || b.overall - a.overall || a.id.localeCompare(b.id));
    const { lineup } = fillSlots(slots, [ordered.filter((card) => card.position !== anyPosition)]);
    if (lineup.every(Boolean)) seeds.push(lineup as T[]);
  }
  const winner = seeds.map(climb).reduce((best, next) => (next.value > best.value ? next : best));
  const chosen = new Set(winner.lineup.map((card) => card.id));
  const rest = cards.filter((card) => !chosen.has(card.id)).sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  return { starters: winner.lineup.map((card) => card.id), bench: rest.slice(0, 7).map((card) => card.id) };
}

export function rearrangeLineup<T extends SelectableCard>(cards: T[], formation: Formation, currentStarters: string[], currentBench: string[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const preferred = currentStarters.map((id) => byId.get(id)).filter((card): card is T => Boolean(card)).sort((a, b) => b.overall - a.overall);
  const others = cards.filter((card) => !currentStarters.includes(card.id)).sort((a, b) => b.overall - a.overall);
  const starters = fillSlots(formations[formation], [preferred, others]).lineup.filter((card): card is T => Boolean(card)).map((card) => card.id);
  const selected = new Set(starters);
  const bench = [...currentBench, ...currentStarters, ...cards.map((card) => card.id)].filter((id, index, all) => !selected.has(id) && all.indexOf(id) === index).slice(0, 7);
  return { starters, bench };
}

// «Velg beste tropp» ser på hele klubben, ikke bare kortene som allerede står i
// troppen: elleveren fylles posisjon for posisjon, benken og reservene tar de
// nest beste. Resten av kortene hører hjemme på lageret.
export function pickBestSquad<T extends SelectableCard & ChemistryPlayer>(cards: T[], formation: Formation, capacity: number) {
  const { starters, bench } = pickBestLineupWithChemistry(cards, formation);
  const chosen = new Set([...starters, ...bench]);
  const reserves = cards
    .filter((card) => !chosen.has(card.id))
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, capacity - chosen.size))
    .map((card) => card.id);
  return { starters, bench, reserves, squad: [...starters, ...bench, ...reserves] };
}
