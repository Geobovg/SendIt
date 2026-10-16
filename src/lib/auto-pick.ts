import "server-only";

import { dbErrorMessage, getT } from "@/i18n/server";
import { formationNames, pickBestSquad, type Formation } from "./lineup";
import { squadCapacity } from "./manager-limits";
import type { supabaseAdmin } from "./supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * «Velg beste tropp»: det beste laget fra hele klubben, lageret inkludert. Kortene hentes inn i troppen og
 * elleveren lagres i samme slengen. Kortene som må vike, går motsatt vei til lageret.
 */
export async function autoPickBestSquad(db: Db, userId: string, formation: Formation): Promise<{ error: string } | null> {
  const [{ data: cards, error: cardsError }, { data: listings, error: listingsError }] = await Promise.all([
    db.from("manager_cards").select("id, catalog_id, position, alt_positions, overall, location, player_catalog(club, league, nation), personal_cards(card_id)").eq("owner_id", userId),
    db.from("market_listings").select("card_id").eq("seller_id", userId).eq("status", "active"),
  ]);
  if (cardsError || listingsError) return { error: await dbErrorMessage((cardsError ?? listingsError)!) };
  // Kort som ligger ute på markedet, kan ikke spilles.
  const listed = new Set((listings ?? []).map((listing) => listing.card_id));
  // Bare ett kort per spiller kan være i troppen. Har man flere (f.eks. vanlig-kortet og informen),
  // velges det beste, og ved lik rating det som allerede ligger der.
  const oneCopyEach = new Map<string, NonNullable<typeof cards>[number]>();
  const candidates = (cards ?? []).filter((card) => !listed.has(card.id));
  for (const card of candidates.sort((a, b) => b.overall - a.overall || Number(b.location === "squad") - Number(a.location === "squad"))) {
    const key = card.catalog_id ?? card.id;
    if (!oneCopyEach.has(key)) oneCopyEach.set(key, card);
  }
  const relation = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);
  const withChemistry = [...oneCopyEach.values()].map((card) => { const catalog = relation(card.player_catalog); return { ...card, altPositions: card.alt_positions ?? [], club: catalog?.club ?? null, league: catalog?.league ?? null, nation: catalog?.nation ?? null, personal: Boolean(relation(card.personal_cards)) }; });
  const best = pickBestSquad(withChemistry, formation, squadCapacity);
  if (best.starters.length !== 11 || best.bench.length !== 7) return { error: (await getT()).career.errors.notEnoughCards };
  const { error } = await db.rpc("auto_pick_manager_squad", { target_user: userId, next_formation: formation, next_squad: best.squad, next_starters: best.starters, next_bench: best.bench });
  if (error) return { error: await dbErrorMessage(error, { stripPrefix: true }) };
  return null;
}

/**
 * Nullstillingen (0081) lagret Academy-troppen som laget til alle, og nye kort legges aldri inn i laget av seg selv.
 * Mange spilte derfor med Academy-elleveren uten å vite det. Står laget fortsatt slik, og brukeren eier andre kort,
 * kjøres «Velg beste tropp» for dem. Etterpå er laget lagret som vanlig, så dette skjer bare én gang per bruker.
 * Går det ikke (f.eks. for få kort til en full benk), står laget som før.
 */
export async function replaceAcademyLineups(db: Db, userIds: string[]) {
  if (!userIds.length) return;
  const { data: lineups } = await db.from("manager_lineups").select("user_id, formation, starters").in("user_id", userIds);
  const starterIds = (lineups ?? []).flatMap((lineup) => (Array.isArray(lineup.starters) ? lineup.starters : []) as string[]);
  if (!starterIds.length) return;
  const { data: starters } = await db.from("manager_cards").select("id, catalog_id, special_card_id, name").in("id", starterIds);
  const academy = new Set((starters ?? []).filter((card) => !card.catalog_id && !card.special_card_id && card.name.startsWith("Academy ")).map((card) => card.id));
  const stale = (lineups ?? []).filter((lineup) => { const ids = (lineup.starters ?? []) as string[]; return ids.length === 11 && ids.every((id) => academy.has(id)); });
  if (!stale.length) return;
  // Bare dem som faktisk har noe bedre: et kort som ikke er fra Academy-troppen (det personlige kortet teller).
  const { data: others } = await db.from("manager_cards").select("owner_id").in("owner_id", stale.map((lineup) => lineup.user_id)).not("name", "like", "Academy %");
  const owners = new Set((others ?? []).map((card) => card.owner_id));
  await Promise.all(stale.filter((lineup) => owners.has(lineup.user_id)).map((lineup) =>
    autoPickBestSquad(db, lineup.user_id, formationNames.includes(lineup.formation as Formation) ? (lineup.formation as Formation) : "4-3-3")));
}
