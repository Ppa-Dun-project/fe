import type {
  DraftConfigLocal,
  DraftPick,
  DraftTeam,
  RosterSlotCounts,
  RosterSlotPosition,
} from "../../types/draft";

/**
 * 기본 14-슬롯 구성:
 *   C, 1B, 2B, 3B, SS, OF×3, UTIL, SP×2, RP×2, BENCH×3
 */
export const DEFAULT_ROSTER_SLOTS: RosterSlotCounts = {
  C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1,
  OF: 3, UTIL: 1,
  SP: 2, RP: 2,
  BENCH: 3,
};

/** 합계 = rosterPlayers 가 되어야 한다는 검증용. */
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

// 옵션 A: 픽 추가 시 클라이언트가 즉시 slotIndex/slotPos 결정.
// 슬롯 인덱스 → 포지션 매핑은 백엔드와 동일한 베이스 템플릿을 그대로 사용.
// 옛 세션 (rosterSlots 없는 경우) 의 fallback 으로 남겨둠.
export const SLOT_TEMPLATE_BASE = [
  "SP", "SP", "RP", "SP", "RP",
  "C", "1B", "2B", "3B", "SS",
  "OF", "OF", "OF", "UTIL", "UTIL",
  "BENCH", "BENCH", "BENCH", "BENCH", "BENCH",
  "BENCH", "BENCH", "BENCH", "BENCH", "BENCH",
] as const;

// rosterSlots 가 있을 때 사용할 동적 슬롯 빌더.
// 순서: SP, RP, C, 1B, 2B, 3B, SS, OF, UTIL, BENCH
// (Draft board 가 사용자가 정한 카운트대로 슬롯을 그리도록 한다.)
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

/** Draft cost style — blurred for unauthenticated users. */
export function draftCostClass(authed: boolean) {
  return authed ? "text-white/80" : "blur-sm select-none text-white/50";
}

/**
 * 선수의 positions 가 해당 슬롯의 position 에 대해 자격을 가지는지 확인.
 *   BENCH: 누구든 OK
 *   UTIL:  비투수면 OK (positions 에 SP/RP 만 있으면 불가)
 *   그 외 (C, 1B, 2B, 3B, SS, OF, SP, RP): 정확히 매칭
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
 * occupied 가 아닌 슬롯 중 player 자격에 맞는 첫 인덱스를 반환.
 * 자격 매칭 우선 순위는 slotTemplate 의 등장 순서(SP, RP, C, 1B, ... BENCH).
 * → 본인 고유 포지션이 비어 있으면 그쪽 먼저, 아니면 UTIL/BENCH 로 fallback.
 * 없으면 -1.
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
 * rosterPlayers 만큼 자른 SLOT_TEMPLATE_BASE 에서 occupied 슬롯을 제외한 첫 빈 자리 인덱스.
 * 전부 차 있으면 -1 반환.
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

/** Current draft round (1-based), capped at total rounds. */
export function calculateCurrentRound(teamCount: number, rosterSlots: number, picks: DraftPick[]) {
  return Math.min(rosterSlots, Math.floor(picks.length / teamCount) + 1);
}

/** Check if player is available, drafted by me, or taken by opponent. */
export function getPlayerDraftStatus(playerId: string, picks: DraftPick[], teams: DraftTeam[]) {
  const hit = picks.find((p) => p.playerId === playerId);
  if (!hit) return { kind: "available" as const };

  const team = teams.find((t) => t.id === hit.draftedByTeamId);
  const bidLabel = hit.bid ?? "?";

  if (hit.type === "mine") {
    return {
      kind: "mine" as const,
      label: `My Pick - $${bidLabel}`,
      teamName: team?.name ?? "My Team",
    };
  }

  return {
    kind: "taken" as const,
    label: `${team?.name ?? "Taken"} - $${bidLabel}`,
    teamName: team?.name ?? "Taken",
  };
}

