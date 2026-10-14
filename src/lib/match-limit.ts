import "server-only";

import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import { supabaseAdmin } from "./supabase/server";

/**
 * Hvor mange kamper én bruker kan starte i løpet av et døgn, i Managerkarrieren (inkludert draft) og i Femmer hver for seg.
 * Noen lot ChatGPT spille kamp etter kamp for seg, og hver kamp koster serverkall hos Vercel.
 */
export const DAILY_MATCHES = 40;
export const DIRECT_FRIEND_MATCHES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ChatGPT-agenten signerer forespørslene sine med Signature-Agent: "https://chatgpt.com".
async function fromChatGptAgent() {
  return ((await headers()).get("signature-agent") ?? "").includes("chatgpt.com");
}

const since = () => new Date(Date.now() - DAY_MS).toISOString();

/** Feilmeldingen hvis brukeren ikke kan starte en managerkamp nå, ellers null. */
export async function managerMatchLimitError(userId: string, { directFriendMatch = false }: { directFriendMatch?: boolean } = {}): Promise<string | null> {
  const errors = (await getT()).career.errors;
  if (await fromChatGptAgent()) return errors.automatedPlay;
  const { count, error } = await supabaseAdmin()
    .from("career_matches")
    .select("id", { count: "exact", head: true })
    .eq("mode", "manager")
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .gte("started_at", since());
  // Appopptellingen gir en tidlig melding; databasen håndhever også managergrensene ved kampstart.
  if (error) return null;
  if ((count ?? 0) >= DAILY_MATCHES) return errors.dailyMatchLimit(DAILY_MATCHES);
  // Draft har også mode=manager og inngår ovenfor. Timekvoten teller kun direkte venneutfordringer.
  if (directFriendMatch) {
    const { count: hourlyCount, error: hourlyError } = await supabaseAdmin()
      .from("career_matches")
      .select("id", { count: "exact", head: true })
      .eq("mode", "manager")
      .not("challenge_id", "is", null)
      .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
      .gte("started_at", new Date(Date.now() - HOUR_MS).toISOString());
    if (!hourlyError && (hourlyCount ?? 0) >= DIRECT_FRIEND_MATCHES_PER_HOUR) return errors.hourlyFriendMatchLimit(DIRECT_FRIEND_MATCHES_PER_HOUR);
  }
  return null;
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
