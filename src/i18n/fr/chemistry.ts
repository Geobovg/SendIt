import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Alchimie",
  total: "Alchimie totale",
  team: (total: number, max: number) => `Alchimie ${total}/${max}`,
  player: (points: number) => `Alchimie ${points}/3`,
  effect: (rating: number) => `+${rating} de note pendant le match`,
  hint: "Les joueurs sur le terrain qui partagent un club, une ligue ou une nation se donnent de l'alchimie : 0 à 3 par joueur et 33 pour toute l'équipe. Chaque point vaut +1 de note pendant le match.",
  club: (count: number, points: number) => `Club : ${count} joueurs (+${points})`,
  league: (count: number, points: number) => `Ligue : ${count} joueurs (+${points})`,
  nation: (count: number, points: number) => `Nation : ${count} joueurs (+${points})`,
  icon: "Icône : alchimie toujours maximale",
  personal: "Carte personnelle : alchimie toujours maximale",
  fixed: (rating: number) => `Alchimie +${rating}`,
  gain: (points: number) => `+${points} d'alchimie`,
  none: "Aucune alchimie",
};
