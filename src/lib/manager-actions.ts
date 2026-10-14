"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, getT } from "@/i18n/server";
import type { ActionState } from "./actions";
import type { TeamView } from "./ai-opponent";
import { requireUser } from "./auth";
import { autoPickBestSquad } from "./auto-pick";
import { getCatalogPage, listCatalogClubs, type CatalogCard } from "./career";
import type { CatalogFilters } from "./catalog-filters";
import { canPlayPosition, formationNames, formations, type Formation } from "./lineup";
import { managerTeamSnapshots } from "./manager-snapshot";
import type { SpecialKind } from "./special-cards";
import { supabaseAdmin } from "./supabase/server";

export async function buyCatalogCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const catalogId = String(formData.get("catalog_id") ?? "");
  if (!catalogId) return { error: (await getT()).career.errors.missingPlayerCard };
  const { error } = await supabaseAdmin().rpc("buy_catalog_card", { target_user: user.id, target_catalog: catalogId });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  return { ok: true };
}

// Katalogen i nettleseren henter én side med kort om gangen herfra når filteret endres eller man trykker «Vis flere».
export async function loadCatalogPageAction(filters: CatalogFilters, offset: number): Promise<{ cards: CatalogCard[]; total: number }> {
  await requireUser();
  const sort = filters.sort === "price-asc" || filters.sort === "price-desc" ? filters.sort : "overall";
  const maximumPrice = filters.maximumPrice === null || !Number.isFinite(Number(filters.maximumPrice)) ? null : Number(filters.maximumPrice);
  return getCatalogPage({ search: String(filters.search ?? "").slice(0, 60), position: String(filters.position ?? "all"), minimum: Number(filters.minimum) || 0, maximumPrice, clubs: (Array.isArray(filters.clubs) ? filters.clubs : []).map(String).slice(0, 100), sort }, Math.max(0, Math.floor(Number(offset) || 0)));
}

export async function loadCatalogClubsAction(): Promise<string[]> {
  await requireUser();
  return listCatalogClubs();
}

export type PackPull = { card_id: string; catalog_id: string; slug: string; name: string; position: string; overall: number; price: number; accent: string; club: string; attributes: Record<string, number>; location: "squad" | "storage"; duplicate: boolean; special: SpecialKind | null; tradable: boolean };
export type PackActionState = ActionState & { pulls?: PackPull[]; openedAt?: number; packKey?: string; jackpot?: number };

export async function openManagerPackAction(_prev: PackActionState, formData: FormData): Promise<PackActionState> {
  const user = await requireUser();
  const packKey = String(formData.get("pack_key") ?? "");
  if (!packKey) return { error: (await getT()).career.errors.choosePack };
  // Gratispakker fra klubbnivå åpnes med samme regler, men trekker ikke managerbudsjett.
  const free = formData.get("free") === "1";
  // Dagspakker (som Ungdomstoooor) er gratis én gang per dag og kan gi en MB-gevinst i tillegg til kortene.
  if (formData.get("daily") === "1") {
    const { data, error } = await supabaseAdmin().rpc("claim_daily_pack", { target_user: user.id, target_pack: packKey });
    if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
    revalidatePath("/managerkarriere");
    const result = (data ?? {}) as { pulls?: PackPull[]; jackpot?: number };
    return { ok: true, pulls: result.pulls ?? [], openedAt: Date.now(), packKey, jackpot: Number(result.jackpot ?? 0) };
  }
  const { data, error } = await supabaseAdmin().rpc(free ? "open_free_manager_pack" : "open_manager_pack", { target_user: user.id, target_pack: packKey });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  // openedAt skiller to like trekk fra hverandre, slik at animasjonen starter på nytt.
  return { ok: true, pulls: (data ?? []) as PackPull[], openedAt: Date.now(), packKey };
}

export type ClaimPickState = ActionState & { pull?: PackPull };

/** Velger ett av de fem kortene i et spillervalg. Kortet havner i klubben. */
export async function claimSpecialPickAction(pickId: string, cardId: string): Promise<ClaimPickState> {
  const user = await requireUser();
  const { data, error } = await supabaseAdmin().rpc("claim_special_pick", { target_user: user.id, target_pick: pickId, target_card: cardId });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  return { ok: true, pull: data as PackPull };
}

export async function moveManagerCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const cardId = String(formData.get("card_id") ?? "");
  const location = String(formData.get("location") ?? "");
  if (!cardId || (location !== "squad" && location !== "storage")) return { error: (await getT()).career.errors.invalidMove };
  const { error } = await supabaseAdmin().rpc("move_manager_card", { target_user: user.id, target_card: cardId, next_location: location });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  return { ok: true };
}

export async function swapManagerCardsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const squadCard = String(formData.get("squad_card") ?? "");
  const storageCard = String(formData.get("storage_card") ?? "");
  if (!squadCard || !storageCard) return { error: (await getT()).career.errors.pickSwapCards };
  const { error } = await supabaseAdmin().rpc("swap_manager_cards", { target_user: user.id, squad_card: squadCard, storage_card: storageCard });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  return { ok: true };
}

export type QuickSellState = ActionState & { payout?: number };

// Hurtigsalg gir 25 % av katalogverdien. Beløpet regnes ut i databasen og vises tilbake til spilleren.
export async function quickSellManagerCardAction(_prev: QuickSellState, formData: FormData): Promise<QuickSellState> {
  const user = await requireUser();
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) return { error: (await getT()).career.errors.missingCard };
  const { data, error } = await supabaseAdmin().rpc("quick_sell_manager_card", { target_user: user.id, target_card: cardId });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  return { ok: true, payout: Number(data ?? 0) };
}

export type QuickSellPackState = ActionState & { payout?: number; soldIds?: string[] };

// «Hurtigselg alle» etter en pakkeåpning. Kortene selges ett og ett med samme regler som
// enkeltsalget, så et kort som ikke kan selges stopper ikke resten.
export async function quickSellPackCardsAction(_prev: QuickSellPackState, formData: FormData): Promise<QuickSellPackState> {
  const user = await requireUser();
  const cardIds = formData.getAll("card_id").map(String).filter(Boolean);
  if (!cardIds.length) return { error: (await getT()).career.errors.missingCard };
  const db = supabaseAdmin();
  let payout = 0; const soldIds: string[] = []; let firstError: string | undefined;
  for (const cardId of cardIds) {
    const { data, error } = await db.rpc("quick_sell_manager_card", { target_user: user.id, target_card: cardId });
    if (error) { firstError ??= await dbErrorMessage(error, { stripPrefix: true }); continue; }
    payout += Number(data ?? 0); soldIds.push(cardId);
  }
  if (soldIds.length) revalidatePath("/managerkarriere");
  return { ok: soldIds.length > 0, payout, soldIds, error: firstError };
}

// «Velg beste tropp» på troppsiden (se autoPickBestSquad).
export async function autoPickBestSquadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const formation = String(formData.get("formation") ?? "4-3-3") as Formation;
  if (!formationNames.includes(formation)) return { error: (await getT()).career.errors.invalidFormation };
  const failed = await autoPickBestSquad(supabaseAdmin(), user.id, formation);
  if (failed) return failed;
  revalidatePath("/managerkarriere");
  return { ok: true };
}

export async function saveManagerLineupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const formation = String(formData.get("formation") ?? "4-3-3") as Formation;
  const starters = formData.getAll("starter_ids").map(String).filter(Boolean);
  const bench = formData.getAll("bench_ids").map(String).filter(Boolean);
  const errors = (await getT()).career.errors;
  if (!formationNames.includes(formation)) return { error: errors.invalidFormation };
  if (starters.length !== 11 || bench.length !== 7) return { error: errors.exactLineup };
  const ids = [...starters, ...bench];
  if (new Set(ids).size !== ids.length) return { error: errors.duplicatePick };
  const db = supabaseAdmin();
  const { data: ownedCards, error: cardsError } = await db.from("manager_cards").select("id, position, location").eq("owner_id", user.id).in("id", ids);
  if (cardsError) return { error: await dbErrorMessage(cardsError) };
  if (ownedCards?.length !== ids.length || ownedCards.some((card) => card.location !== "squad")) return { error: errors.unusableCard };
  const positions = new Map((ownedCards ?? []).map((card) => [card.id, card.position]));
  if (starters.some((id, index) => !canPlayPosition(positions.get(id) ?? "", formations[formation][index].position))) return { error: errors.wrongPosition };
  const { error } = await db.rpc("save_manager_lineup", { target_user: user.id, next_formation: formation, next_starters: starters, next_bench: bench });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  revalidatePath("/managerkarriere");
  return { ok: true };
}

/** Det ekte laget til en bruker, med de faktiske ratingene, f.eks. når du trykker på en venn. */
export async function managerTeamAction(userId: string): Promise<TeamView | { error: string }> {
  await requireUser(); const db = supabaseAdmin();
  const [snapshots, { data: profile }, { data: career }] = await Promise.all([
    managerTeamSnapshots(db, [userId], { realPlayers: true }),
    db.from("profiles").select("username").eq("id", userId).maybeSingle(),
    db.from("player_profiles").select("club_name").eq("user_id", userId).maybeSingle(),
  ]);
  if ("error" in snapshots) return { error: snapshots.error };
  const t = await getT();
  const team = snapshots.get(userId);
  if (!profile || !team) return { error: t.seasons.team.none };
  return { name: profile.username, subtitle: career?.club_name ? t.career.clubName(career.club_name) : null, formation: team.formation, starters: team.starters, bench: team.bench, kind: "real" };
}
