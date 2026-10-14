import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Kemia",
  total: "Kemia yhteensä",
  team: (total: number, max: number) => `Kemia ${total}/${max}`,
  player: (points: number) => `Kemia ${points}/3`,
  effect: (rating: number) => `+${rating} luokitusta ottelussa`,
  hint: "Kentällä olevat pelaajat, joilla on sama seura, liiga tai maa, antavat toisilleen kemiaa: 0–3 per pelaaja ja 33 koko joukkueelle. Jokainen piste on +1 luokitusta ottelussa.",
  club: (count: number, points: number) => `Seura: ${count} pelaajaa (+${points})`,
  league: (count: number, points: number) => `Liiga: ${count} pelaajaa (+${points})`,
  nation: (count: number, points: number) => `Maa: ${count} pelaajaa (+${points})`,
  icon: "Ikoni: aina täysi kemia",
  personal: "Henkilökohtainen kortti: aina täysi kemia",
  fixed: (rating: number) => `Kemia +${rating}`,
  gain: (points: number) => `+${points} kemiaa`,
  none: "Ei kemiaa",
};
