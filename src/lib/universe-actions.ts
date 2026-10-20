"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { requireUser } from "./auth";
import { supabaseAdmin } from "./supabase/server";

/** Markerer overgangen til det nye universet som sett, så animasjonen ikke vises igjen. */
export async function acknowledgeUniverseAction() {
  const user = await requireUser();
  const { error } = await supabaseAdmin().from("universe_archives").update({ seen_at: new Date().toISOString() }).eq("user_id", user.id).is("seen_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/managerkarriere", "layout");
}

/** Bytter til et av de andre universene dine. Kampen eller draften du er i, må være ferdig først. */
export async function switchUniverseAction(universe: number): Promise<{ error: string } | { ok: true }> {
  const user = await requireUser();
  const text = (await getT()).universe.switch;
  if (!Number.isInteger(universe) || universe < 1) return { error: text.missing };
  const { error } = await supabaseAdmin().rpc("switch_universe", { target_user: user.id, target_universe: universe });
  if (error) return { error: error.message.includes("universe_busy") ? text.busy : error.message.includes("universe_missing") ? text.missing : error.message };
  revalidatePath("/managerkarriere", "layout");
  return { ok: true };
}
