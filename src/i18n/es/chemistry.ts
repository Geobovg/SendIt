import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "Química",
  total: "Química total",
  team: (total: number, max: number) => `Química ${total}/${max}`,
  player: (points: number) => `Química ${points}/3`,
  effect: (rating: number) => `+${rating} de media en el partido`,
  hint: "Los jugadores en el campo que comparten club, liga o nacionalidad se dan química: 0–3 por jugador y 33 para todo el equipo. Cada punto es +1 de media en el partido.",
  club: (count: number, points: number) => `Club: ${count} jugadores (+${points})`,
  league: (count: number, points: number) => `Liga: ${count} jugadores (+${points})`,
  nation: (count: number, points: number) => `Nación: ${count} jugadores (+${points})`,
  icon: "Icono: siempre química completa",
  personal: "Carta personal: siempre química completa",
  fixed: (rating: number) => `Química +${rating}`,
  gain: (points: number) => `+${points} de química`,
  none: "Sin química",
};
