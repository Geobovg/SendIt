import { MeatballSplash } from "@/components/meatball-splash";
import { currentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";

// Den offisielle forsiden. Teksten er på norsk uansett språk; knappen går videre til spillet.
export default async function HomePage() {
  const [user, t] = await Promise.all([currentUser(), getT()]);
  return <MeatballSplash title="Snart middag brødre!" enterHref={user ? "/meny" : "/login"} enterLabel={t.common.enterGame} />;
}
