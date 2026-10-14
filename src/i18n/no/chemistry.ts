import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Kjemi",
  total: "Total kjemi",
  team: (total: number, max: number) => `Kjemi ${total}/${max}`,
  player: (points: number) => `Kjemi ${points}/3`,
  effect: (rating: number) => `+${rating} rating i kampen`,
  hint: "Spillere på banen som deler klubb, liga eller nasjon gir hverandre kjemi: 0–3 per spiller og 33 for hele laget. Hvert poeng er +1 rating i kampen.",
  club: (count: number, points: number) => `Klubb: ${count} spillere (+${points})`,
  league: (count: number, points: number) => `Liga: ${count} spillere (+${points})`,
  nation: (count: number, points: number) => `Nasjon: ${count} spillere (+${points})`,
  icon: "Ikon: alltid full kjemi",
  personal: "Personlig kort: alltid full kjemi",
  fixed: (rating: number) => `Kjemi +${rating}`,
  gain: (points: number) => `+${points} kjemi`,
  none: "Ingen kjemi",
};
