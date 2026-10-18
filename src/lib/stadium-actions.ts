"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { BUILDERS, collectable, effectiveLevels, incomeOf, isBuildingKey, planUpgrade } from "./stadium";
import { getStadiumState } from "./stadium-data";
import { supabaseAdmin } from "./supabase/server";

/** Årsakene databasen og planleggingen kan gi, oversatt i t.stadium.errors. */
export type StadiumReason = "invalid" | "max_level" | "klubbhus_low" | "busy" | "builders_busy" | "no_money" | "stale" | "nothing" | "no_profile";
export type StadiumResult = { ok: true; amount?: number } | { ok: false; reason: StadiumReason };

/** Starter oppgraderingen av en bygning. Pris og tid regnes ut her; databasen trekker pengene og tar byggeren i samme transaksjon. */
export async function startStadiumUpgradeAction(building: string): Promise<StadiumResult> {
  const user = await requireUser();
  if (!isBuildingKey(building)) return { ok: false, reason: "invalid" };
  const db = supabaseAdmin();
  const plan = planUpgrade(await getStadiumState(user.id, db), building, new Date());
  if ("block" in plan) return { ok: false, reason: plan.block };
  const { data, error } = await db.rpc("stadium_start_upgrade", {
    target_user: user.id, target_building: building, target_level: plan.to, upgrade_cost: plan.cost, upgrade_seconds: plan.minutes * 60, builder_count: BUILDERS, min_klubbhus: plan.minKlubbhus,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/managerkarriere", "layout");
  return data.ok ? { ok: true } : { ok: false, reason: data.reason };
}

/** Tømmer billettluka og legger MB-ene på budsjettet. */
export async function collectStadiumIncomeAction(): Promise<StadiumResult> {
  const user = await requireUser();
  const db = supabaseAdmin();
  const state = await getStadiumState(user.id, db);
  const now = new Date();
  if (collectable(state, now) < 1) return { ok: false, reason: "nothing" };
  const { perHour, capacity } = incomeOf(effectiveLevels(state, now));
  const { data, error } = await db.rpc("stadium_collect", { target_user: user.id, hourly_rate: perHour, capacity });
  if (error) throw new Error(error.message);
  revalidatePath("/managerkarriere", "layout");
  return data.ok ? { ok: true, amount: data.amount } : { ok: false, reason: data.reason };
}
