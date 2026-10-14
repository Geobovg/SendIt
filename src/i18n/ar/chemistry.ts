import type { ChemistryDict } from "../en/chemistry";

export const chemistry: ChemistryDict = {
  label: "الكيمياء",
  total: "إجمالي الكيمياء",
  team: (total: number, max: number) => `الكيمياء ${total}/${max}`,
  player: (points: number) => `الكيمياء ${points}/3`,
  effect: (rating: number) => `+${rating} تقييم في المباراة`,
  hint: "اللاعبون في الملعب الذين يتشاركون النادي أو الدوري أو المنتخب يمنحون بعضهم الكيمياء: من 0 إلى 3 لكل لاعب و33 للفريق كله. كل نقطة تعادل +1 تقييم في المباراة.",
  club: (count: number, points: number) => `النادي: ${count} لاعبين (+${points})`,
  league: (count: number, points: number) => `الدوري: ${count} لاعبين (+${points})`,
  nation: (count: number, points: number) => `المنتخب: ${count} لاعبين (+${points})`,
  icon: "أيقونة: كيمياء كاملة دائمًا",
  personal: "بطاقة شخصية: كيمياء كاملة دائمًا",
  fixed: (rating: number) => `الكيمياء +${rating}`,
  gain: (points: number) => `+${points} كيمياء`,
  none: "لا كيمياء",
};
