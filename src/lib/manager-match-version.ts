import "server-only";

import { createHash } from "node:crypto";

/** Kolonnene i career_match_shots som kampbildet bruker. Samme liste hos siden og hos versjonssjekken. */
export const matchShotColumns = "minute, kind, side, shooter_cell, keeper_cell, outcome";

type ShotRow = { minute: number; kind: string; side: string; shooter_cell: number | null; keeper_cell: number | null; outcome: string | null };
type VersionedMatch = { status: string; started_at: string | null; home_score: number; away_score: number; events: unknown };

/**
 * Et fingeravtrykk av alt som kan endre seg i en kamp som pågår: status, hendelsene (bytter og «ferdig» i
 * byttevinduet) og valgene og utfallene på sjansene. Klienten sammenligner det med fingeravtrykket siden ble
 * tegnet med, og henter siden på nytt bare når de er ulike.
 */
export function matchVersion(match: VersionedMatch, shots: ShotRow[]): string {
  const state = JSON.stringify([match.status, match.started_at, match.home_score, match.away_score, match.events, shots.map((shot) => [shot.minute, shot.kind, shot.side, shot.shooter_cell, shot.keeper_cell, shot.outcome])]);
  return createHash("sha1").update(state).digest("base64url");
}
