import "server-only";

import type { ManagerTeamSnapshot } from "./manager-match";
import { homeBonusOf, isBuildingKey, startLevels, type StadiumState } from "./stadium";
import { supabaseAdmin } from "./supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

/** Stadionet til én manager. Bygninger uten rad står på startnivået. */
export async function getStadiumState(userId: string, db: Db = supabaseAdmin()): Promise<StadiumState> {
  const [{ data: rows, error }, { data: profile, error: profileError }] = await Promise.all([
    db.from("stadium_buildings").select("building, level, upgrade_to, upgrade_ends_at").eq("user_id", userId),
    db.from("player_profiles").select("stadium_collected_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (profileError) throw new Error(profileError.message);
  const levels = startLevels();
  const upgrades: StadiumState["upgrades"] = [];
  for (const row of rows ?? []) {
    if (!isBuildingKey(row.building)) continue;
    levels[row.building] = row.level;
    if (row.upgrade_to && row.upgrade_ends_at) upgrades.push({ building: row.building, to: row.upgrade_to, endsAt: new Date(row.upgrade_ends_at) });
  }
  return { levels, upgrades, collectedAt: profile?.stadium_collected_at ? new Date(profile.stadium_collected_at) : new Date() };
}

/** Hjemmebanebonusen til laget som spiller hjemme, i rating. 0 uten tribune. */
export async function getHomeBonus(userId: string, db: Db = supabaseAdmin()): Promise<number> {
  const { data, error } = await db.from("stadium_buildings").select("building, level, upgrade_to, upgrade_ends_at").eq("user_id", userId).eq("building", "tribune");
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return 0;
  const levels = startLevels();
  const finished = row.upgrade_to && row.upgrade_ends_at && new Date(row.upgrade_ends_at).getTime() <= Date.now();
  levels.tribune = finished ? row.upgrade_to : row.level;
  return homeBonusOf(levels);
}

/** Hjemmelaget med hjemmebanebonusen fra tribunen lagt på den skjulte styrken. Bare for ekte managere, ikke AI-klubber. */
export async function withHomeBonus(team: ManagerTeamSnapshot, db: Db = supabaseAdmin()): Promise<ManagerTeamSnapshot> {
  const bonus = await getHomeBonus(team.userId, db);
  return bonus > 0 ? { ...team, bonus: (team.bonus ?? 0) + bonus } : team;
}
