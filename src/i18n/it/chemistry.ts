import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Intesa",
  total: "Intesa totale",
  team: (total: number, max: number) => `Intesa ${total}/${max}`,
  player: (points: number) => `Intesa ${points}/3`,
  effect: (rating: number) => `+${rating} di valutazione in partita`,
  hint: "I giocatori in campo che condividono club, campionato o nazionalità si danno intesa: da 0 a 3 per giocatore e 33 per tutta la squadra. Ogni punto vale +1 di valutazione in partita.",
  club: (count: number, points: number) => `Club: ${count} giocatori (+${points})`,
  league: (count: number, points: number) => `Campionato: ${count} giocatori (+${points})`,
  nation: (count: number, points: number) => `Nazione: ${count} giocatori (+${points})`,
  icon: "Icona: intesa sempre al massimo",
  personal: "Carta personale: intesa sempre al massimo",
  fixed: (rating: number) => `Intesa +${rating}`,
  gain: (points: number) => `+${points} di intesa`,
  none: "Nessuna intesa",
};
