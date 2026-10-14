import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Kemi",
  total: "Samlet kemi",
  team: (total: number, max: number) => `Kemi ${total}/${max}`,
  player: (points: number) => `Kemi ${points}/3`,
  effect: (rating: number) => `+${rating} rating i kampen`,
  hint: "Spillere på banen, der deler klub, liga eller nation, giver hinanden kemi: 0–3 pr. spiller og 33 for hele holdet. Hvert point er +1 rating i kampen.",
  club: (count: number, points: number) => `Klub: ${count} spillere (+${points})`,
  league: (count: number, points: number) => `Liga: ${count} spillere (+${points})`,
  nation: (count: number, points: number) => `Nation: ${count} spillere (+${points})`,
  icon: "Ikon: altid fuld kemi",
  personal: "Personligt kort: altid fuld kemi",
  fixed: (rating: number) => `Kemi +${rating}`,
  gain: (points: number) => `+${points} kemi`,
  none: "Ingen kemi",
};
