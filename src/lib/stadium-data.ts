import "server-only";

import { isBuildingKey, startLevels, type ScoutOffer, type StadiumScout, type StadiumState } from "./stadium";
import { supabaseAdmin } from "./supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

type OfferRow = { pack_key: string; player: { catalog_id: string; slug: string; name: string; position: string; overall: number; club: string; accent: string; attributes: Record<string, number>; price: number } | null };

function toOffer(row: OfferRow | null): ScoutOffer | null {
  if (!row) return null;
  const player = row.player;
  return { packKey: row.pack_key, player: player ? { catalogId: player.catalog_id, slug: player.slug, name: player.name, position: player.position, overall: player.overall, club: player.club, accent: player.accent, attributes: player.attributes ?? {}, price: player.price } : null };
}

/** Stadionet til én manager. Bygninger uten rad står på startnivået, som er likt for alle. */
export async function getStadiumState(userId: string, db: Db = supabaseAdmin()): Promise<StadiumState> {
  const [{ data: rows, error }, { data: profile, error: profileError }, { data: scoutRow, error: scoutError }] = await Promise.all([
    db.from("stadium_buildings").select("building, level, upgrade_to, upgrade_started_at, upgrade_ends_at").eq("user_id", userId),
    db.from("player_profiles").select("stadium_collected_at, stadium_xp_collected_at").eq("user_id", userId).maybeSingle(),
    db.from("stadium_scouts").select("level, started_at, ends_at, offer").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (profileError) throw new Error(profileError.message);
  if (scoutError) throw new Error(scoutError.message);
  const levels = startLevels();
  const upgrades: StadiumState["upgrades"] = [];
  for (const row of rows ?? []) {
    if (!isBuildingKey(row.building)) continue;
    levels[row.building] = row.level;
    if (row.upgrade_to && row.upgrade_ends_at) upgrades.push({ building: row.building, to: row.upgrade_to, startedAt: new Date(row.upgrade_started_at ?? row.upgrade_ends_at), endsAt: new Date(row.upgrade_ends_at) });
  }
  const scout: StadiumScout | null = scoutRow ? { level: scoutRow.level, startedAt: new Date(scoutRow.started_at), endsAt: new Date(scoutRow.ends_at), offer: toOffer(scoutRow.offer as OfferRow | null) } : null;
  return {
    levels, upgrades, scout,
    collectedAt: profile?.stadium_collected_at ? new Date(profile.stadium_collected_at) : new Date(),
    xpCollectedAt: profile?.stadium_xp_collected_at ? new Date(profile.stadium_xp_collected_at) : new Date(),
  };
}
