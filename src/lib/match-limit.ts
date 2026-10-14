import "server-only";

import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import { supabaseAdmin } from "./supabase/server";

/**
 * Hvor mange kamper én bruker kan starte per 6-timersperiode, i Managerkarrieren (inkludert draft) og i Femmer hver for seg.
 * Periodene er faste etter norsk tid (00–06, 06–12, 12–18, 18–24), og telleren nullstilles ved hver grense.
 * Noen lot ChatGPT spille kamp etter kamp for seg, og hver kamp koster serverkall hos Vercel.
 */
export const PERIOD_MATCHES = 40;
export const DIRECT_FRIEND_MATCHES_PER_HOUR = 5;
const PERIOD_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

// ChatGPT-agenten signerer forespørslene sine med Signature-Agent: "https://chatgpt.com".
async function fromChatGptAgent() {
  return ((await headers()).get("signature-agent") ?? "").includes("chatgpt.com");
}

/** Forskjellen mellom norsk tid og UTC (ms) på et gitt tidspunkt, så sommertid blir riktig. */
function osloOffsetMs(at: Date) {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Oslo", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  return offset ? (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60 * 1000 : 0;
}

/** Starten på inneværende 6-timersperiode (kl. 00, 06, 12 eller 18 norsk tid) som tidspunkt. Samme regel som i migrering 0098. */
function osloPeriodStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  const startHour = Math.floor(Number(part("hour")) / PERIOD_HOURS) * PERIOD_HOURS;
  const wallClock = new Date(`${part("year")}-${part("month")}-${part("day")}T${String(startHour).padStart(2, "0")}:00:00Z`);
  // Veggklokketiden er regnet som om den var UTC. Første forsøk gir et tidspunkt nær nok til å lese riktig forskjell.
  const guess = new Date(wallClock.getTime() - osloOffsetMs(wallClock));
  return new Date(wallClock.getTime() - osloOffsetMs(guess));
}

/** Tidspunktet alle tellere sist ble nullstilt for alle brukere (tabellen match_limit_resets), eller null hvis aldri. */
async function lastReset(): Promise<Date | null> {
  const { data, error } = await supabaseAdmin().from("match_limit_resets").select("reset_at").order("reset_at", { ascending: false }).limit(1).maybeSingle();
  return error || !data ? null : new Date(data.reset_at);
}

const laterOf = (first: Date, second: Date | null) => (second && second > first ? second : first);

/** Kamper startet fra dette tidspunktet teller mot grensen: starten på perioden, men aldri før siste nullstilling. */
async function periodSince() {
  return laterOf(osloPeriodStart(), await lastReset()).toISOString();
}

export type MatchQuota = { used: number; max: number; hoursLeft: number };

/** Hele timer (rundet opp) til neste periode starter. Perioder er 5–7 timer på dager med sommertid, så vi leser starten på neste periode 9 timer etter starten på denne. */
function hoursUntilReset(now = new Date()) {
  const nextStart = osloPeriodStart(new Date(osloPeriodStart(now).getTime() + 9 * HOUR_MS));
  return Math.max(1, Math.ceil((nextStart.getTime() - now.getTime()) / HOUR_MS));
}

/** Hvor mange managerkamper (inkludert draft) brukeren har startet i denne perioden, eller null hvis tellingen feiler. */
export async function managerMatchQuota(userId: string): Promise<MatchQuota | null> {
  const { count, error } = await supabaseAdmin()
    .from("career_matches")
    .select("id", { count: "exact", head: true })
    .eq("mode", "manager")
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .gte("started_at", await periodSince());
  return error ? null : { used: count ?? 0, max: PERIOD_MATCHES, hoursLeft: hoursUntilReset() };
}

/** Hvor mange femmerkamper brukeren har startet i denne perioden, eller null hvis tellingen feiler. */
export async function fiveMatchQuota(userId: string): Promise<MatchQuota | null> {
  const { count, error } = await supabaseAdmin()
    .from("five_matches")
    .select("id", { count: "exact", head: true })
    .eq("controller_id", userId)
    .gte("started_at", await periodSince());
  return error ? null : { used: count ?? 0, max: PERIOD_MATCHES, hoursLeft: hoursUntilReset() };
}

/** Feilmeldingen hvis brukeren ikke kan starte en managerkamp nå, ellers null. */
export async function managerMatchLimitError(userId: string, { directFriendMatch = false }: { directFriendMatch?: boolean } = {}): Promise<string | null> {
  const errors = (await getT()).career.errors;
  if (await fromChatGptAgent()) return errors.automatedPlay;
  const { count, error } = await supabaseAdmin()
    .from("career_matches")
    .select("id", { count: "exact", head: true })
    .eq("mode", "manager")
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .gte("started_at", await periodSince());
  // Appopptellingen gir en tidlig melding; databasen håndhever også managergrensene ved kampstart.
  if (error) return null;
  if ((count ?? 0) >= PERIOD_MATCHES) return errors.periodMatchLimit(PERIOD_MATCHES);
  // Draft har også mode=manager og inngår ovenfor. Timekvoten teller kun direkte venneutfordringer.
  if (directFriendMatch) {
    const { count: hourlyCount, error: hourlyError } = await supabaseAdmin()
      .from("career_matches")
      .select("id", { count: "exact", head: true })
      .eq("mode", "manager")
      .not("challenge_id", "is", null)
      .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
      .gte("started_at", laterOf(new Date(Date.now() - HOUR_MS), await lastReset()).toISOString());
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
    .gte("started_at", await periodSince());
  if (error) return null;
  return (count ?? 0) >= PERIOD_MATCHES ? errors.periodMatchLimit(PERIOD_MATCHES) : null;
}
