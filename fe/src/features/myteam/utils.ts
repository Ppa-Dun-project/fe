import type { MyTeamPlayer, MyTeamPosFilter, MyTeamSort } from "../../types/myteam";
import type {
  DraftPick,
  DraftPlayerPublic,
  DraftPlayerValue,
} from "../../types/draft";
import type { UnsavedDraft } from "../draft/draftHelpers";

// Same shape as the backend MyTeamPlayersResponse (myteam.py).
export type MyTeamSynthesized = {
  items: MyTeamPlayer[];
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
};

// Synthesizes an unsaved draft (sessionStorage) into the same shape as the backend my-team response.
// A client-side mirror of the backend's pick_my_players + get_budget_summary — so that the
// My Team page reflects picks in real time even before saving.
export function synthesizeUnsavedMyTeam(
  unsaved: UnsavedDraft,
  publicPlayers: DraftPlayerPublic[],
  values: DraftPlayerValue[] | null,
): MyTeamSynthesized {
  // Main picks only — the backend returns every kind, but minor/taxi picks have slotPos === null
  // so they can't be mapped to a pos: string. Showing only the main roster is also semantically aligned.
  const mine = unsaved.picks
    .filter((p) => p.draftedByTeamId === "team-0" && (p.kind ?? "main") === "main")
    .sort((a, b) => a.slotIndex - b.slotIndex);

  const playersById = new Map(publicPlayers.map((p) => [p.id, p]));
  const valueById = new Map((values ?? []).map((v) => [v.playerId, v.ppaValue]));

  const items: MyTeamPlayer[] = [];
  for (const pick of mine) {
    const player = playersById.get(pick.playerId);
    if (!player) continue;

    const item = buildMyTeamItemFromPick(pick, player, valueById.get(player.id) ?? null);
    items.push(item);
  }

  const totalBudget = unsaved.config?.budget ?? 0;
  const spentBudget = items.reduce((sum, p) => sum + p.cost, 0);
  const remainingBudget = Math.max(0, totalBudget - spentBudget);

  return { items, totalBudget, spentBudget, remainingBudget };
}

function buildMyTeamItemFromPick(
  pick: DraftPick,
  player: DraftPlayerPublic,
  ppaValue: number | null,
): MyTeamPlayer {
  // SP/RP slots are treated as pitchers (including two_way players). Otherwise use player.playerType as-is.
  const isPitcherSlot = pick.slotPos === "SP" || pick.slotPos === "RP";
  const playerType: "batter" | "pitcher" =
    player.playerType === "pitcher" || (player.playerType === "two_way" && isPitcherSlot)
      ? "pitcher"
      : "batter";

  // Mirrors the backend: for BENCH, wrap the original position in parentheses; absorb DH/TWP into UTIL.
  let displayPos: string;
  if (pick.slotPos === "BENCH") {
    const raw = player.positions[0] ?? "UTIL";
    const original = raw === "DH" || raw === "TWP" ? "UTIL" : raw;
    displayPos = `BENCH(${original})`;
  } else {
    displayPos = pick.slotPos ?? "UTIL";
  }

  return {
    id: player.id,
    name: player.name,
    playerType,
    pos: displayPos,
    cost: pick.bid ?? 0,
    team: player.team ?? "",
    avg: playerType === "batter" ? player.avg ?? 0 : 0,
    hr: playerType === "batter" ? player.hr ?? 0 : 0,
    rbi: playerType === "batter" ? player.rbi ?? 0 : 0,
    sb: playerType === "batter" ? player.sb ?? 0 : 0,
    w: playerType === "pitcher" ? player.w ?? 0 : null,
    sv: playerType === "pitcher" ? player.sv ?? 0 : null,
    so: playerType === "pitcher" ? player.so ?? 0 : null,
    era: playerType === "pitcher" ? Number((player.era ?? 0).toFixed(2)) : null,
    whip: playerType === "pitcher" ? Number((player.whip ?? 0).toFixed(3)) : null,
    ip: playerType === "pitcher" ? Number((player.ip ?? 0).toFixed(1)) : null,
    ppaValue: ppaValue ?? 0,
  };
}

function isPitcher(player: MyTeamPlayer) {
  return player.playerType === "pitcher";
}

function rateSortValue(player: MyTeamPlayer) {
  return isPitcher(player) ? (player.era == null ? 0 : -player.era) : player.avg;
}

function powerSortValue(player: MyTeamPlayer) {
  return isPitcher(player) ? player.so ?? 0 : player.hr;
}

function productionSortValue(player: MyTeamPlayer) {
  return isPitcher(player) ? player.w ?? 0 : player.rbi;
}

function speedSortValue(player: MyTeamPlayer) {
  return isPitcher(player) ? player.sv ?? 0 : player.sb;
}

/**
 * Filters the player list
 * - Search by name/team (case-insensitive)
 * - Position filter (ALL matches everything)
 * - Formats like BENCH(1B) also match if the position substring is contained in the player's pos string
 */
export function filterMyTeam(
  players: MyTeamPlayer[],
  query: string,
  pos: MyTeamPosFilter
): MyTeamPlayer[] {
  const q = query.trim().toLowerCase();

  return players.filter((player) => {
    const matchesQuery =
      !q || player.name.toLowerCase().includes(q) || player.team.toLowerCase().includes(q);
    const matchesPos = pos === "ALL" ? true : player.pos.includes(pos);
    return matchesQuery && matchesPos;
  });
}

/** Sorts the player list (applying the comparison function for each sort option). */
export function sortMyTeam(players: MyTeamPlayer[], sort: MyTeamSort): MyTeamPlayer[] {
  // Use a copy to avoid mutating the source array.
  const copy = [...players];

  switch (sort) {
    case "score_desc":
      return copy.sort((a, b) => b.ppaValue - a.ppaValue);
    case "score_asc":
      return copy.sort((a, b) => a.ppaValue - b.ppaValue);
    case "cost_desc":
      return copy.sort((a, b) => b.cost - a.cost);
    case "cost_asc":
      return copy.sort((a, b) => a.cost - b.cost);
    case "avg_desc":
      return copy.sort((a, b) => rateSortValue(b) - rateSortValue(a));
    case "hr_desc":
      return copy.sort((a, b) => powerSortValue(b) - powerSortValue(a));
    case "rbi_desc":
      return copy.sort((a, b) => productionSortValue(b) - productionSortValue(a));
    case "sb_desc":
      return copy.sort((a, b) => speedSortValue(b) - speedSortValue(a));
    default:
      return copy;
  }
}

/** Formats a batting average in baseball notation like ".300" (returns "-" if 0). */
export function formatAvg(avg: number) {
  if (!avg) return "-";
  return avg.toFixed(3).replace("0.", ".");
}

