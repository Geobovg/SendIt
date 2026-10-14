import type { MatchQuota } from "@/lib/match-limit";

/** Liten teller som viser hvor mange kamper brukeren har spilt i dag og hvor lenge det er til den nullstilles. */
export function MatchQuotaBadge({ quota, label }: { quota: MatchQuota | null; label: (used: number, max: number, hours: number) => string }) {
  if (!quota) return null;
  const full = quota.used >= quota.max;
  return <p className={`rounded-xl border px-3 py-2 text-xs font-black tracking-wide ${full ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/10 bg-slate-900/75 text-white/60"}`}>{label(quota.used, quota.max, quota.hoursLeft)}</p>;
}
