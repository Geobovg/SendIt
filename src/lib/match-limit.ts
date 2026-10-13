import "server-only";

import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import type { supabaseAdmin } from "./supabase/server";

/**
 * Hvor mange managerkamper én bruker kan starte i løpet av et døgn. Noen lot ChatGPT spille kamp etter
 * kamp for seg, og hver kamp koster serverkall hos Vercel. 30 kamper er mer enn halvannen times spill.
 */
export const DAILY_MANAGER_MATCHES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// ChatGPT-agenten signerer forespørslene sine med Signature-Agent: "https://chatgpt.com".
async function fromChatGptAgent() {
  return ((await headers()).get("signature-agent") ?? "").includes("chatgpt.com");
}

/** Feilmeldingen hvis brukeren ikke kan starte en managerkamp nå, ellers null. */
export async function managerMatchLimitError(db: ReturnType<typeof supabaseAdmin>, userId: string): Promise<string | null> {
  const errors = (await getT()).career.errors;
  if (await fromChatGptAgent()) return errors.automatedPlay;
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error } = await db
    .from("career_matches")
    .select("id", { count: "exact", head: true })
    .eq("mode", "manager")
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .gte("started_at", since);
  // Feiler opptellingen, får kampen starte heller enn at ingen kan spille.
  if (error) return null;
  return (count ?? 0) >= DAILY_MANAGER_MATCHES ? errors.dailyMatchLimit(DAILY_MANAGER_MATCHES) : null;
}
