import "server-only";

import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import { supabaseAdmin } from "./supabase/server";

/**
 * Hvor mange kamper én bruker kan starte i løpet av et døgn, i Managerkarrieren og i Femmer hver for seg.
 * Noen lot ChatGPT spille kamp etter kamp for seg, og hver kamp koster serverkall hos Vercel.
 */
export const DAILY_MATCHES = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

// ChatGPT-agenten signerer forespørslene sine med Signature-Agent: "https://chatgpt.com".
async function fromChatGptAgent() {
  return ((await headers()).get("signature-agent") ?? "").includes("chatgpt.com");
}

const since = () => new Date(Date.now() - DAY_MS).toISOString();

/** Feilmeldingen hvis brukeren ikke kan starte en managerkamp nå, ellers null. */
export async function managerMatchLimitError(userId: string): Promise<string | null> {
  const errors = (await getT()).career.errors;
  if (await fromChatGptAgent()) return errors.automatedPlay;
  const { count, error } = await supabaseAdmin()
    .from("career_matches")
    .select("id", { count: "exact", head: true })
    .eq("mode", "manager")
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .gte("started_at", since());
  // Feiler opptellingen, får kampen starte heller enn at ingen kan spille.
  if (error) return null;
  return (count ?? 0) >= DAILY_MATCHES ? errors.dailyMatchLimit(DAILY_MATCHES) : null;
}

/** Feilmeldingen hvis brukeren ikke kan starte en femmerkamp nå, ellers null. Teller kampene brukeren selv har spilt. */
export async function fiveMatchLimitError(userId: string): Promise<string | null> {
  const errors = (await getT()).femmer.errors;
  if (await fromChatGptAgent()) return errors.automatedPlay;
  const { count, error } = await supabaseAdmin()
    .from("five_matches")
    .select("id", { count: "exact", head: true })
    .eq("controller_id", userId)
    .gte("started_at", since());
  if (error) return null;
  return (count ?? 0) >= DAILY_MATCHES ? errors.dailyMatchLimit(DAILY_MATCHES) : null;
}
