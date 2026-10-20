import "server-only";

import { cache } from "react";
import type { CardFacePlayer } from "@/components/player-card-face";
import { supabaseAdmin } from "./supabase/server";

/** Ett lagret kort i et arkivert univers: det PlayerCardFace trenger, pluss nasjonen. */
export type ArchivedCard = CardFacePlayer & { nation: string | null };
export type ArchivedSeason = { season_number: number; arena: number; division: number; final_position: number | null; outcome: "promoted" | "relegated" | "stayed" | "champion" | null };
/** Et av de andre universene dine slik det sto da du forlot det (migrering 0128 og 0129). */
export type UniverseSnapshot = {
  club_name: string; club_xp: number; budget_earned: number; wins: number; draws: number; losses: number; formation: string | null; rating: number | null;
  starters: ArchivedCard[]; bench: ArchivedCard[]; card_count: number; seasons: ArchivedSeason[];
};
export type UniverseArchive = { universe: number; snapshot: UniverseSnapshot; archivedAt: string; seen: boolean };
export type UniverseNav = { current: number; archives: { universe: number; rating: number | null; seen: boolean }[]; pending: UniverseArchive | null };

export const getUniverse = cache(async (userId: string): Promise<number> => {
  const { data, error } = await supabaseAdmin().from("player_profiles").select("universe").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.universe ?? 1;
});

/** Universet du er i, de andre universene dine, og om overgangsanimasjonen for det siste ikke er sett ennå. */
export async function getUniverseNav(userId: string): Promise<UniverseNav> {
  const db = supabaseAdmin();
  const [current, { data, error }] = await Promise.all([
    getUniverse(userId),
    db.from("universe_archives").select("universe, snapshot, archived_at, seen_at").eq("user_id", userId).order("universe", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  // Universet du er i har et gammelt bilde fra forrige gang du forlot det. Det vises ikke, siden du er der nå.
  const archives = (data ?? []).filter((row) => row.universe !== current).map((row) => ({ universe: row.universe as number, snapshot: row.snapshot as UniverseSnapshot, archivedAt: row.archived_at as string, seen: row.seen_at !== null }));
  return {
    current,
    archives: archives.map((archive) => ({ universe: archive.universe, rating: archive.snapshot.rating, seen: archive.seen })),
    pending: archives.filter((archive) => !archive.seen).at(-1) ?? null,
  };
}

export async function getUniverseArchive(userId: string, universe: number): Promise<UniverseArchive | null> {
  const { data, error } = await supabaseAdmin().from("universe_archives").select("universe, snapshot, archived_at, seen_at").eq("user_id", userId).eq("universe", universe).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { universe: data.universe, snapshot: data.snapshot as UniverseSnapshot, archivedAt: data.archived_at, seen: data.seen_at !== null } : null;
}

/** Markedet og salg mellom managere går bare innenfor ett univers. */
export async function sameUniverse(userId: string, otherId: string): Promise<boolean> {
  return (await getUniverse(userId)) === (await getUniverse(otherId));
}
