import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "化学反应",
  total: "总化学反应",
  team: (total: number, max: number) => `化学反应 ${total}/${max}`,
  player: (points: number) => `化学反应 ${points}/3`,
  effect: (rating: number) => `比赛中评分 +${rating}`,
  hint: "场上拥有相同俱乐部、联赛或国籍的球员会互相提升化学反应：每名球员 0–3，全队 33。每 1 点化学反应在比赛中相当于评分 +1。",
  club: (count: number, points: number) => `俱乐部：${count} 名球员 (+${points})`,
  league: (count: number, points: number) => `联赛：${count} 名球员 (+${points})`,
  nation: (count: number, points: number) => `国籍：${count} 名球员 (+${points})`,
  icon: "传奇球星：化学反应始终满值",
  personal: "个人卡：化学反应始终满值",
  fixed: (rating: number) => `化学反应 +${rating}`,
  gain: (points: number) => `+${points} 化学反应`,
  none: "无化学反应",
};
