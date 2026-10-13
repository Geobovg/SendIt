import "server-only";

import { dbErrorMessage } from "@/i18n/server";
import { replaceAcademyLineups } from "./auto-pick";
import { anyPosition, formationNames, formations, pickBestLineup, type Formation } from "./lineup";
import type { ManagerPlayerSnapshot, ManagerTeamSnapshot } from "./manager-match";
import type { supabaseAdmin } from "./supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;
type Relation<T> = T | T[] | null;
type CardRow = { id: string; owner_id: string; name: string; position: string; overall: number; catalog_id: string | null; special_card_id: string | null; player_catalog: Relation<{ slug: string; club: string; accent: string }>; personal_cards: Relation<{ slug: string }> };

const cardColumns = "id, owner_id, name, position, overall, catalog_id, special_card_id, player_catalog(slug, club, accent), personal_cards(slug)";
const first = <T,>(value: Relation<T>) => (Array.isArray(value) ? value[0] ?? null : value);

function uniqueIds(value: unknown) { return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : []; }

// Katalogdataene blir med i laguttaket slik at kampbildet kan tegne spillerkortene uten flere oppslag.
function toPlayer(card: CardRow): ManagerPlayerSnapshot {
  const catalog = first(card.player_catalog); const personal = first(card.personal_cards);
  return { id: card.id, name: card.name, position: card.position, overall: card.overall, slug: catalog?.slug ?? personal?.slug ?? null, club: catalog?.club ?? null, accent: catalog?.accent ?? null };
}

/** Startkortene alle fikk ved nullstillingen («Academy CB» osv.). De har ingen katalograd, og er ikke spesial- eller personlige kort. */
const isAcademy = (card: CardRow) => !card.catalog_id && !card.special_card_id && !first(card.personal_cards) && card.name.startsWith("Academy ");

/**
 * Laguttakene slik de står nå. Managere uten gyldig ellever er ikke med i svaret.
 *
 * Med `realPlayers` vises laget med spillerne brukeren faktisk har: står det lagrede laget fortsatt som
 * Academy-troppen fra nullstillingen, og brukeren eier ekte spillere, brukes den beste elleveren av alle kortene
 * deres (samme regel som «Velg beste tropp»). Det lagrede laget oppdateres ikke når man får nye kort, så mange
 * har aldri byttet det ut. Brukes når andre ser laget eller møter det i AI-sesongen, ikke i brukerens egne kamper.
 */
export async function managerTeamSnapshots(db: Db, userIds: string[], { realPlayers = false } = {}): Promise<Map<string, ManagerTeamSnapshot> | { error: string }> {
  // Står laget fortsatt som Academy-troppen, byttes det ut med det beste laget før kampen eller visningen.
  await replaceAcademyLineups(db, userIds);
  const { data: lineups, error: lineupsError } = await db.from("manager_lineups").select("user_id, formation, starters, bench").in("user_id", userIds);
  if (lineupsError) return { error: await dbErrorMessage(lineupsError) };
  const allIds = (lineups ?? []).flatMap((lineup) => [...uniqueIds(lineup.starters), ...uniqueIds(lineup.bench)]);
  const { data: cards, error: cardsError } = allIds.length ? await db.from("manager_cards").select(cardColumns).in("id", allIds) : { data: [], error: null };
  if (cardsError) return { error: await dbErrorMessage(cardsError) };
  const cardById = new Map(((cards ?? []) as unknown as CardRow[]).map((card) => [card.id, card]));

  // Hele klubben til dem som fortsatt har Academy-elleveren lagret.
  const stale = realPlayers ? (lineups ?? []).filter((lineup) => { const starters = uniqueIds(lineup.starters); return starters.length === 11 && starters.every((id) => { const card = cardById.get(id); return card && isAcademy(card); }); }).map((lineup) => lineup.user_id) : [];
  const { data: clubCards, error: clubError } = stale.length ? await db.from("manager_cards").select(cardColumns).in("owner_id", stale) : { data: [], error: null };
  if (clubError) return { error: await dbErrorMessage(clubError) };

  const snapshots = new Map<string, ManagerTeamSnapshot>();
  for (const lineup of lineups ?? []) {
    const formation = formationNames.includes(lineup.formation as Formation) ? (lineup.formation as Formation) : "4-3-3";
    let starters = uniqueIds(lineup.starters); let bench = uniqueIds(lineup.bench);
    let owned = new Map<string, CardRow>([...starters, ...bench].flatMap((id) => { const card = cardById.get(id); return card && card.owner_id === lineup.user_id ? [[id, card] as [string, CardRow]] : []; }));
    const club = ((clubCards ?? []) as unknown as CardRow[]).filter((card) => card.owner_id === lineup.user_id);
    if (club.some((card) => !isAcademy(card))) {
      const best = pickBestLineup(club, formation);
      if (best.starters.length === 11) { starters = best.starters; bench = best.bench; owned = new Map(club.map((card) => [card.id, card])); }
    }
    if (starters.length !== 11 || bench.length > 7 || starters.some((id) => bench.includes(id))) continue;
    // Et kort som kan spille alt, spiller på plassen det står på i formasjonen. På benken beholder det «ALL»,
    // og tar posisjonen til den det bytter med (se lineupAtMinute i manager-match.ts).
    const slots = formations[formation];
    const selectedStarters = starters.map((id) => owned.get(id)).filter((card): card is CardRow => Boolean(card)).map(toPlayer)
      .map((card, index) => (card.position === anyPosition ? { ...card, position: slots[index].position } : card));
    const selectedBench = bench.map((id) => owned.get(id)).filter((card): card is CardRow => Boolean(card)).map(toPlayer);
    if (selectedStarters.length === 11 && selectedBench.length === bench.length) snapshots.set(lineup.user_id, { userId: lineup.user_id, formation, starters: selectedStarters, bench: selectedBench });
  }
  return snapshots;
}
