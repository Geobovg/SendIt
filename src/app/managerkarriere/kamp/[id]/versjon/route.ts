import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { matchShotColumns, matchVersion } from "@/lib/manager-match-version";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Den lette sjekken kampbildet gjør mens kampen går: bare fingeravtrykket av kampen, uten layout, uten
 * navn og klubber og uten å tegne siden. Klienten henter hele siden på nytt først når fingeravtrykket er endret.
 */
export async function GET(_request: Request, ctx: RouteContext<"/managerkarriere/kamp/[id]/versjon">) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const [{ data: match }, { data: shots }] = await Promise.all([
    db.from("career_matches").select("status, started_at, home_score, away_score, events, home_user_id, away_user_id").eq("id", id).eq("mode", "manager").or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`).maybeSingle(),
    db.from("career_match_shots").select(matchShotColumns).eq("match_id", id).order("minute", { ascending: true }),
  ]);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ version: matchVersion(match, shots ?? []) }, { headers: { "Cache-Control": "no-store" } });
}
