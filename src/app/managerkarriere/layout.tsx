import { ManagerBottomNav } from "@/components/manager-bottom-nav";
import { UniverseTransition } from "@/components/universe-panels";
import { sessionUserId } from "@/lib/auth";
import { getUniverseNav } from "@/lib/universe";

export default async function ManagerCareerLayout({ children }: LayoutProps<"/managerkarriere">) {
  // Har du nettopp vunnet Camp Nou, vises overgangen til det nye universet over alt annet til du har sett den.
  const userId = await sessionUserId();
  const { current, pending } = userId ? await getUniverseNav(userId) : { current: 1, pending: null };
  // Luft nederst, så fanelinjen aldri dekker det siste på siden.
  return <div className="pb-24">{children}<ManagerBottomNav />{pending ? <UniverseTransition from={pending.universe} to={current} /> : null}</div>;
}
