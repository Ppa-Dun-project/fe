import type {
  ContractCode,
  DraftConfigLocal,
  DraftPick,
  DraftTeam,
  RosterSlotCounts,
  RosterSlotPosition,
} from "../../types/draft";

/**
 * Default 14-slot layout:
 *   C, 1B, 2B, 3B, SS, OF×3, UTIL, SP×2, RP×2, BENCH×3
 */
export const DEFAULT_ROSTER_SLOTS: RosterSlotCounts = {
  C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1,
  OF: 3, UTIL: 1,
  SP: 2, RP: 2,
  BENCH: 3,
};

/** Used for validation: the sum must equal rosterPlayers. */
export function sumRosterSlots(slots: RosterSlotCounts): number {
  return Object.values(slots).reduce((sum, n) => sum + n, 0);
}

export const DEFAULT_CONFIG = {
  myTeamName: "My Team",
  oppTeamNames: [] as string[],
  opponentsCount: 0,
  leagueType: "AL",
  budget: 260,
  rosterPlayers: sumRosterSlots(DEFAULT_ROSTER_SLOTS),
  rosterSlots: DEFAULT_ROSTER_SLOTS,
} satisfies DraftConfigLocal;

// Option A: when a pick is added, the client decides slotIndex/slotPos immediately.
// The slot index → position mapping uses the exact same base template as the backend.
// Kept around as a fallback for older sessions (where rosterSlots is missing).
export const SLOT_TEMPLATE_BASE = [
  "SP", "SP", "RP", "SP", "RP",
  "C", "1B", "2B", "3B", "SS",
  "OF", "OF", "OF", "UTIL", "UTIL",
  "BENCH", "BENCH", "BENCH", "BENCH", "BENCH",
  "BENCH", "BENCH", "BENCH", "BENCH", "BENCH",
] as const;

// Dynamic slot builder used when rosterSlots is present.
// Order: SP, RP, C, 1B, 2B, 3B, SS, OF, UTIL, BENCH
// (Lets the draft board draw slots according to the counts the user configured.)
const SLOT_ORDER: RosterSlotPosition[] = [
  "SP", "RP", "C", "1B", "2B", "3B", "SS", "OF", "UTIL", "BENCH",
];

export function buildSlotTemplateFromCounts(slots: RosterSlotCounts): string[] {
  const out: string[] = [];
  for (const pos of SLOT_ORDER) {
    const n = slots[pos] ?? 0;
    for (let i = 0; i < n; i += 1) out.push(pos);
  }
  return out;
}

const TEAM_PALETTE = [
  { header: "border-rose-400/30 bg-rose-500/10 text-rose-200", slot: "border-rose-400/20 bg-rose-500/8", text: "text-rose-200" },
  { header: "border-amber-400/30 bg-amber-500/10 text-amber-200", slot: "border-amber-400/20 bg-amber-500/8", text: "text-amber-200" },
  { header: "border-violet-400/30 bg-violet-500/10 text-violet-200", slot: "border-violet-400/20 bg-violet-500/8", text: "text-violet-200" },
  { header: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", slot: "border-emerald-400/20 bg-emerald-500/8", text: "text-emerald-200" },
  { header: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200", slot: "border-cyan-400/20 bg-cyan-500/8", text: "text-cyan-200" },
  { header: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200", slot: "border-fuchsia-400/20 bg-fuchsia-500/8", text: "text-fuchsia-200" },
];

const MY_TEAM_ACCENT = {
  header: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  slot: "border-sky-400/20 bg-sky-500/8",
  text: "text-sky-200",
};

const MLB_TEAM_CLASSES: Record<string, string> = {
  NYY: "bg-sky-500/15 text-sky-200 border-sky-400/25",
  LAD: "bg-blue-500/15 text-blue-200 border-blue-400/25",
  NYM: "bg-indigo-500/15 text-indigo-200 border-indigo-400/25",
  ATL: "bg-red-500/15 text-red-200 border-red-400/25",
  PHI: "bg-rose-500/15 text-rose-200 border-rose-400/25",
  HOU: "bg-orange-500/15 text-orange-200 border-orange-400/25",
  LAA: "bg-amber-500/15 text-amber-200 border-amber-400/25",
  CLE: "bg-violet-500/15 text-violet-200 border-violet-400/25",
  KC: "bg-cyan-500/15 text-cyan-200 border-cyan-400/25",
  SD: "bg-yellow-500/15 text-yellow-200 border-yellow-400/25",
  TEX: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
  BAL: "bg-orange-500/15 text-orange-200 border-orange-400/25",
  CIN: "bg-red-500/15 text-red-200 border-red-400/25",
  SEA: "bg-teal-500/15 text-teal-200 border-teal-400/25",
};

/** Enforce roster size bounds: 1 ≤ n ≤ 25. */
export function clampRosterSize(n?: number) {
  return Math.min(Math.max(n ?? 12, 1), 25);
}

/** Build roster slot layout for the given number of players. */
export function buildSlotTemplate(count: number): string[] {
  return SLOT_TEMPLATE_BASE.slice(0, count) as unknown as string[];
}

/** Team color classes for the draft board. My team uses sky palette; others rotate. */
export function teamAccentClass(team: DraftTeam, index: number) {
  return team.isMine ? MY_TEAM_ACCENT : TEAM_PALETTE[index % TEAM_PALETTE.length];
}

/** MLB team badge colors; falls back to neutral for unknown teams. */
export function mlbTeamBadgeClass(team: string): string {
  return MLB_TEAM_CLASSES[team.toUpperCase()] ?? "bg-white/10 text-white/80 border-white/15";
}

/** Format batting average as ".300" (no leading zero). */
export function formatAvg(avg: number | null) {
  if (avg === null || avg === undefined) return "-";
  return avg.toFixed(3).replace("0.", ".");
}

/**
 * Check whether the player's positions qualify for the given slot position.
 *   BENCH: anyone is OK
 *   UTIL:  any non-pitcher is OK (not eligible if positions contains only SP/RP)
 *   Everything else (C, 1B, 2B, 3B, SS, OF, SP, RP): exact match required
 */
export function isEligibleForSlot(
  playerPositions: readonly string[] | undefined,
  slotPos: string
): boolean {
  if (slotPos === "BENCH") return true;
  const positions = playerPositions ?? [];
  if (slotPos === "UTIL") {
    return positions.some((p) => p !== "SP" && p !== "RP");
  }
  return positions.includes(slotPos);
}

/**
 * Returns the first index, among non-occupied slots, that the player is eligible for.
 * Eligibility priority follows the order slots appear in slotTemplate (SP, RP, C, 1B, ... BENCH).
 * → If the player's own primary position is open, fill that first; otherwise fall back to UTIL/BENCH.
 * Returns -1 if none match.
 */
export function findEligibleSlotIndex(
  playerPositions: readonly string[] | undefined,
  slotTemplate: readonly string[],
  occupied: Set<number>
): number {
  for (let i = 0; i < slotTemplate.length; i += 1) {
    if (occupied.has(i)) continue;
    if (isEligibleForSlot(playerPositions, slotTemplate[i])) return i;
  }
  return -1;
}

/**
 * Returns the index of the first empty slot in SLOT_TEMPLATE_BASE (truncated to rosterPlayers), excluding occupied slots.
 * Returns -1 if every slot is filled.
 */
export function findAvailableSlotIndex(rosterPlayers: number, occupied: Set<number>): number {
  const limit = Math.min(rosterPlayers, SLOT_TEMPLATE_BASE.length);
  for (let i = 0; i < limit; i += 1) {
    if (!occupied.has(i)) return i;
  }
  return -1;
}

/** Remaining budget for a team after subtracting all their bids. */
export function calculateRemainingBudget(budget: number, myTeamId: string, picks: DraftPick[]) {
  const spent = picks
    .filter((p) => p.draftedByTeamId === myTeamId && typeof p.bid === "number")
    .reduce((sum, p) => sum + (p.bid ?? 0), 0);
  return Math.max(0, budget - spent);
}

/** Current draft round (1-based), capped at total rounds.
 *  Minor/taxi picks don't affect main draft progress, so they're excluded from the count. */
export function calculateCurrentRound(teamCount: number, rosterSlots: number, picks: DraftPick[]) {
  const mainCount = picks.filter((p) => p.kind === "main").length;
  return Math.min(rosterSlots, Math.floor(mainCount / teamCount) + 1);
}

/** Number of slots on the minor/taxi board. Unlike main, these are flat slots with no position labels. */
export const MINOR_TAXI_SLOT_COUNT = 8;

/** For boards without eligibility checks (minor/taxi), returns the first non-occupied slot. Returns -1 if none. */
export function findFirstEmptySlot(occupied: Set<number>, count: number): number {
  for (let i = 0; i < count; i += 1) {
    if (!occupied.has(i)) return i;
  }
  return -1;
}

/**
 * Season rollover table for keeper / contract codes.
 * {code: [state when elapsed=0, elapsed=1, ...]} — any elapsed value past the end falls to "X".
 * Must stay 1:1 in sync with the backend's _ROLLOVER_TABLE in be/contract_rollover.py.
 */
const ROLLOVER_TABLE: Record<ContractCode, ContractCode[]> = {
  F3: ["F3", "F2", "F1"],
  F2: ["F2", "F1"],
  F1: ["F1"],
  S1: ["S1"],
  L2: ["L2", "LX"],
  LX: ["LX"],
  X: [],
};

/**
 * Compute the current contract state from the code at acquisition time and how many seasons have passed.
 *  - code is null/undefined: an older pick without keeper info → returns null
 *  - yearsElapsed ≤ 0: abnormal input (e.g. replaying the past) → returns the original code unchanged
 *  - elapsed past the table length: "X" (expired)
 *
 * Whether to actually exclude the pick is decided by the caller (the import preview UI).
 */
export function rolledContract(
  code: ContractCode | null | undefined,
  yearsElapsed: number,
): ContractCode | null {
  if (code == null) return null;
  if (yearsElapsed <= 0) return code;

  const timeline = ROLLOVER_TABLE[code];
  if (!timeline) return code;
  if (yearsElapsed < timeline.length) return timeline[yearsElapsed];
  return "X";
}

/** Check if player is available, drafted by me, or taken by opponent.
 *  Also exposes pickKind and teamId so callers can apply the (minor)/(taxi) prefix and team color. */
export function getPlayerDraftStatus(playerId: string, picks: DraftPick[], teams: DraftTeam[]) {
  const hit = picks.find((p) => p.playerId === playerId);
  if (!hit) return { kind: "available" as const };

  const team = teams.find((t) => t.id === hit.draftedByTeamId);
  const teamName = team?.name ?? (hit.type === "mine" ? "My Team" : "Taken");
  const pickKind = hit.kind ?? "main";
  const teamId = hit.draftedByTeamId;

  if (pickKind !== "main") {
    const boardLabel = pickKind === "minor" ? "Minor" : "Taxi";
    return {
      kind: hit.type, // "mine" | "taken" — same branching as before
      pickKind,
      label: `${boardLabel} - ${teamName}`,
      teamName,
      teamId,
    } as const;
  }

  const bidLabel = hit.bid ?? "?";
  if (hit.type === "mine") {
    return {
      kind: "mine" as const,
      pickKind: "main" as const,
      label: `My Pick - $${bidLabel}`,
      teamName,
      teamId,
    };
  }

  return {
    kind: "taken" as const,
    pickKind: "main" as const,
    label: `${teamName} - $${bidLabel}`,
    teamName,
    teamId,
  };
}

