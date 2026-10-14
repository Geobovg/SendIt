import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagerTopBar } from "@/components/manager-navigation";
import { ManagerOverview } from "@/components/manager-overview";
import { MatchQuotaBadge } from "@/components/match-quota";
import { AiSeasonHero, FriendSeasonTeaser } from "@/components/season-panels";
import { currentUser, sessionUserId } from "@/lib/auth";
import { getCareerChallenges, getCareerProfile, getManagerHome, listManagerMatchHistory } from "@/lib/career";
import { DRAFT_ENTRY_FEE } from "@/lib/draft-core";
import { getDraftHub } from "@/lib/draft";
import { squadCapacity } from "@/lib/manager-limits";
import { managerMatchQuota } from "@/lib/match-limit";
import { getAiSeason, getFriendSeasons } from "@/lib/seasons";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ManagerCareerPage() {
  // Id-en kommer fra den signerte cookien, så alt kan hentes samtidig i stedet for etter hverandre.
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const careerPromise = getCareerProfile(userId);
  const [user, career, manager, challenges, matches, friendSeasons, season, draft, quota] = await Promise.all([currentUser(), careerPromise, getManagerHome(userId), getCareerChallenges(userId), listManagerMatchHistory(userId), getFriendSeasons(userId), getAiSeason(userId), getDraftHub(userId), managerMatchQuota(userId)]);
  if (!user) redirect("/login");
  const t = await getT();
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <ManagerTopBar clubName={career.club_name} budget={career.manager_budget} rating={manager.rating} clubXp={career.club_xp} />
    <MatchQuotaBadge quota={quota} label={t.career.quota} />
    <AiSeasonHero season={season} />
    <FriendSeasonTeaser seasons={friendSeasons} />
    <Link href="/managerkarriere/draft" className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-lime-300/30 bg-[#08101b] p-4 transition hover:border-lime-300/70" style={{ backgroundImage: "radial-gradient(circle at 95% 0%, rgba(152,255,44,.18), transparent 40%)" }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-300 text-lg font-black text-slate-950">★</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black tracking-widest text-lime-300">{draft.invites ? t.draft.hub.invites(draft.invites).toUpperCase() : draft.running ? t.draft.hub.active.toUpperCase() : t.draft.hub.eyebrow}</p>
        <p className="truncate font-black">{t.draft.hub.title}</p>
        <p className="line-clamp-2 text-xs text-white/55">{t.draft.hub.text(DRAFT_ENTRY_FEE)}</p>
      </div>
      <span className="shrink-0 text-sm font-black text-lime-300">{t.draft.hub.open}</span>
    </Link>
    <Link href="/managerkarriere/lagtropp" className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/75 p-4 transition hover:border-lime-300/50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-lime-300">◈</span>
      <div className="min-w-0 flex-1"><p className="text-xs font-black tracking-widest text-white/45">{t.career.home.yourSquad}</p><p className="truncate font-black">{t.career.home.squadSummary(manager.formation, String(manager.rating ?? "—"), manager.squadCount, squadCapacity)}</p></div>
      <span className="shrink-0 text-sm font-black text-lime-300">{t.career.home.edit}</span>
    </Link>
    <ManagerOverview userId={user.id} challenges={challenges} matches={matches} packs={manager.packs} freePacks={manager.freePacks} budget={career.manager_budget} record={{ wins: career.manager_career_wins, draws: career.manager_career_draws, losses: career.manager_career_losses }} />
  </div>;
}
