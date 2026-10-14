import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Chemie",
  total: "Gesamtchemie",
  team: (total: number, max: number) => `Chemie ${total}/${max}`,
  player: (points: number) => `Chemie ${points}/3`,
  effect: (rating: number) => `+${rating} Wertung im Spiel`,
  hint: "Spieler auf dem Platz, die Verein, Liga oder Nation teilen, geben sich gegenseitig Chemie: 0–3 pro Spieler und 33 für das ganze Team. Jeder Punkt ist +1 Wertung im Spiel.",
  club: (count: number, points: number) => `Verein: ${count} Spieler (+${points})`,
  league: (count: number, points: number) => `Liga: ${count} Spieler (+${points})`,
  nation: (count: number, points: number) => `Nation: ${count} Spieler (+${points})`,
  icon: "Ikone: immer volle Chemie",
  personal: "Persönliche Karte: immer volle Chemie",
  fixed: (rating: number) => `Chemie +${rating}`,
  gain: (points: number) => `+${points} Chemie`,
  none: "Keine Chemie",
};
