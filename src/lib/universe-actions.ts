"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { supabaseAdmin } from "./supabase/server";

/** Markerer overgangen til det nye universet som sett, så animasjonen ikke vises igjen. */
export async function acknowledgeUniverseAction() {
  const user = await requireUser();
  const { error } = await supabaseAdmin().from("universe_archives").update({ seen_at: new Date().toISOString() }).eq("user_id", user.id).is("seen_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/managerkarriere", "layout");
}
