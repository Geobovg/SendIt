export const chemistry = {
  label: "Chemistry",
  total: "Total chemistry",
  team: (total: number, max: number) => `Chemistry ${total}/${max}`,
  player: (points: number) => `Chemistry ${points}/3`,
  effect: (rating: number) => `+${rating} rating in the match`,
  hint: "Players on the pitch who share a club, league or nation give each other chemistry: 0–3 per player, 33 for the whole team. Each point is +1 rating in the match.",
  club: (count: number, points: number) => `Club: ${count} players (+${points})`,
  league: (count: number, points: number) => `League: ${count} players (+${points})`,
  nation: (count: number, points: number) => `Nation: ${count} players (+${points})`,
  icon: "Icon: always full chemistry",
  personal: "Personal card: always full chemistry",
  fixed: (rating: number) => `Chemistry +${rating}`,
  gain: (points: number) => `+${points} chemistry`,
  none: "No chemistry",
};

export type ChemistryDict = typeof chemistry;
