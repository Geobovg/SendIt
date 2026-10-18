"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import {
  FREE_FINISH_SECONDS, SCOUT_HOURS, SCOUT_PRICE_FACTOR, SPEEDUP_MB_PER_HOUR, buildersFor, collectable, effectiveLevels, isBuildingKey, planUpgrade, rateOf, scoutReward, scoutStatus,
  type Collector,
} from "./stadium";
import { getStadiumState } from "./stadium-data";
import { supabaseAdmin } from "./supabase/server";

/** Årsakene databasen og planleggingen kan gi, oversatt i t.stadium.errors. */
export type StadiumReason =
  | "invalid" | "max_level" | "klubbhus_low" | "busy" | "builders_busy" | "no_money" | "stale" | "nothing" | "no_profile"
  | "not_building" | "no_hut" | "scout_busy" | "scout_away" | "no_scout" | "no_offer" | "owned" | "no_room";
export type StadiumResult = { ok: true; amount?: number; cost?: number; kind?: "pack" | "player"; packKey?: string } | { ok: false; reason: StadiumReason };

const fail = (reason: string): StadiumResult => ({ ok: false, reason: reason as StadiumReason });
function done() { revalidatePath("/managerkarriere", "layout"); }

type RpcAnswer = { ok: boolean; reason?: string; [key: string]: unknown };
async function call(name: string, args: Record<string, unknown>): Promise<RpcAnswer> {
  const { data, error } = await supabaseAdmin().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as RpcAnswer;
}

/** Starter oppgraderingen av en bygning. Pris og tid regnes ut her; databasen trekker pengene og tar byggeren i samme transaksjon. */
export async function startStadiumUpgradeAction(building: string): Promise<StadiumResult> {
  const user = await requireUser();
  if (!isBuildingKey(building)) return fail("invalid");
  const now = new Date();
  const state = await getStadiumState(user.id);
  const plan = planUpgrade(state, building, now);
  if ("block" in plan) return fail(plan.block);
  const answer = await call("stadium_start_upgrade", {
    target_user: user.id, target_building: building, target_level: plan.to, upgrade_cost: plan.cost, upgrade_seconds: plan.minutes * 60,
    builder_count: buildersFor(effectiveLevels(state, now)), min_klubbhus: plan.minKlubbhus,
  });
  done();
  return answer.ok ? { ok: true } : fail(answer.reason ?? "invalid");
}

/** Gjør en pågående oppgradering ferdig nå mot MB. Databasen regner ut prisen fra tiden som er igjen. */
export async function speedUpStadiumAction(building: string): Promise<StadiumResult> {
  const user = await requireUser();
  if (!isBuildingKey(building)) return fail("invalid");
  const answer = await call("stadium_speedup", { target_user: user.id, target_building: building, mb_per_hour: SPEEDUP_MB_PER_HOUR, free_seconds: FREE_FINISH_SECONDS });
  done();
  return answer.ok ? { ok: true, cost: Number(answer.cost ?? 0) } : fail(answer.reason ?? "invalid");
}

/** Tømmer billettluka (MB) eller treningsfeltet (klubb-XP). */
export async function collectStadiumAction(collector: Collector): Promise<StadiumResult> {
  const user = await requireUser();
  if (collector !== "mb" && collector !== "xp") return fail("invalid");
  const state = await getStadiumState(user.id);
  const now = new Date();
  if (collectable(state, now, collector) < 1) return fail("nothing");
  const { perHour, capacity } = rateOf(effectiveLevels(state, now), collector);
  const answer = await call("stadium_collect", { target_user: user.id, collector, hourly_rate: perHour, capacity });
  done();
  return answer.ok ? { ok: true, amount: Number(answer.amount ?? 0) } : fail(answer.reason ?? "invalid");
}

/** Sender ut en speider. Nivået på hytta nå avgjør hva han kommer hjem med. */
export async function sendScoutAction(): Promise<StadiumResult> {
  const user = await requireUser();
  const state = await getStadiumState(user.id);
  const level = effectiveLevels(state, new Date()).speiderhytte;
  if (level < 1) return fail("no_hut");
  const answer = await call("stadium_scout_send", { target_user: user.id, scout_level: level, mission_seconds: SCOUT_HOURS * 3600 });
  done();
  return answer.ok ? { ok: true } : fail(answer.reason ?? "invalid");
}

/** Åpner det speideren fant. Forslaget lagres i databasen, så det står fast til manageren har valgt. */
export async function openScoutAction(): Promise<StadiumResult> {
  const user = await requireUser();
  const state = await getStadiumState(user.id);
  if (!state.scout) return fail("no_scout");
  const status = scoutStatus(state, new Date());
  if (status === "away") return fail("scout_away");
  const reward = scoutReward(state.scout.level);
  if (!reward) return fail("no_scout");
  const answer = await call("stadium_scout_reveal", { target_user: user.id, min_overall: reward.minOverall, max_overall: reward.maxOverall, pack_key: reward.packKey, price_factor: SCOUT_PRICE_FACTOR });
  done();
  return answer.ok ? { ok: true } : fail(answer.reason ?? "invalid");
}

/** Velger mellom pakka og spilleren speideren kom hjem med. */
export async function chooseScoutAction(choice: string): Promise<StadiumResult> {
  const user = await requireUser();
  if (choice !== "pack" && choice !== "player") return fail("invalid");
  const answer = await call("stadium_scout_choose", { target_user: user.id, choice });
  done();
  return answer.ok ? { ok: true, kind: answer.kind as "pack" | "player", packKey: typeof answer.pack_key === "string" ? answer.pack_key : undefined } : fail(answer.reason ?? "invalid");
}
