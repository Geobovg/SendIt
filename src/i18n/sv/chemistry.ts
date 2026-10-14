import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Kemi",
  total: "Total kemi",
  team: (total: number, max: number) => `Kemi ${total}/${max}`,
  player: (points: number) => `Kemi ${points}/3`,
  effect: (rating: number) => `+${rating} rating i matchen`,
  hint: "Spelare på planen som delar klubb, liga eller nation ger varandra kemi: 0–3 per spelare och 33 för hela laget. Varje poäng är +1 rating i matchen.",
  club: (count: number, points: number) => `Klubb: ${count} spelare (+${points})`,
  league: (count: number, points: number) => `Liga: ${count} spelare (+${points})`,
  nation: (count: number, points: number) => `Nation: ${count} spelare (+${points})`,
  icon: "Ikon: alltid full kemi",
  personal: "Personligt kort: alltid full kemi",
  fixed: (rating: number) => `Kemi +${rating}`,
  gain: (points: number) => `+${points} kemi`,
  none: "Ingen kemi",
};
