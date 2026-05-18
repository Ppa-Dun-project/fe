// Pure helpers + constants + response/payload types extracted from DraftPage.tsx
// so the page component can focus on orchestration. Anything in this file is
// React-free and safe to import from anywhere in the draft feature.

import type {
  DraftConfigServer,
  DraftPick,
  DraftPlayer,
  DraftPlayerPublic,
  DraftPlayerValue,
  DraftPositionFilter,
  DraftSort,
  DraftTeam,
  SessionSummary,
} from "../../types/draft";
import { DEFAULT_ROSTER_SLOTS, formatAvg, sumRosterSlots } from "./utils";

// ── Constants ─────────────────────────────────────────────────────────

export const UNSAVED_DRAFT_KEY = "ppadun_unsaved_draft";

export const DEFAULT_DRAFT_CONFIG: DraftConfigServer = {
  leagueType: "AL",
  budget: 260,
  rosterPlayers: sumRosterSlots(DEFAULT_ROSTER_SLOTS),
  myTeamName: "My Team",
  opponentsCount: 11,
  oppTeamNames: Array.from({ length: 11 }, (_, i) => `Opponent ${i + 1}`),
  rosterSlots: DEFAULT_ROSTER_SLOTS,
};

export const DEFAULT_POSITION_FILTERS: DraftPositionFilter[] = [
  "C", "1B", "2B", "3B", "SS", "OF", "UTIL", "SP", "RP",
];

export const BATTER_SORT_OPTIONS: { value: DraftSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc",  label: "By Draft Cost" },
  { value: "avg_desc",   label: "By AVG" },
  { value: "hr_desc",    label: "By HR" },
  { value: "rbi_desc",   label: "By RBI" },
  { value: "sb_desc",    label: "By SB" },
];

export const PITCHER_SORT_OPTIONS: { value: DraftSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc",  label: "By Draft Cost" },
  { value: "avg_desc",   label: "By ERA" },
  { value: "hr_desc",    label: "By SO" },
  { value: "rbi_desc",   label: "By W" },
  { value: "sb_desc",    label: "By SV" },
];

// ── Inline API response & sessionStorage payload types ────────────────

export type DraftPlayersResponse = { items: DraftPlayerPublic[] };
export type DraftPlayerValuesResponse = { items: DraftPlayerValue[] };
export type SessionsListResponse = { items: SessionSummary[] };

// sessionStorage 페이로드 — DraftSetupCard 가 쓰고 DraftPage 가 읽는다.
// 같은 탭에서 페이지 이동/새로고침 동안만 유지, 창을 닫으면 사라짐.
export type UnsavedDraft = {
  config: DraftConfigServer;
  picks: DraftPick[];
  notes?: Record<string, string>; // playerId → note (저장 전 클라이언트 보관)
};

// ── Filtering / predicates ────────────────────────────────────────────

// 모든 필터는 정확한 포지션 일치 — UTIL 칩은 "UTIL 자격" 보유 선수만 골라낸다.
export function matchesPositionFilter(
  playerPositions: readonly string[] | undefined,
  filter: DraftPositionFilter,
): boolean {
  if (!playerPositions || playerPositions.length === 0) return false;
  const normalized = playerPositions.map((p) => p.toUpperCase());
  return normalized.includes(filter);
}

export function isPitcherOnly(player: DraftPlayerPublic): boolean {
  return player.playerType === "pitcher";
}

export function isPitcherPositionFilter(filter: DraftPositionFilter): boolean {
  return filter === "SP" || filter === "RP";
}

// ── Formatters ────────────────────────────────────────────────────────

export function formatNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(digits);
}

export function formatDraftStatSummary(player: DraftPlayerPublic) {
  if (isPitcherOnly(player)) {
    return `ERA ${formatNumber(player.era, 2)} | SO ${player.so ?? "-"} | W ${player.w ?? "-"} | SV ${player.sv ?? "-"} | IP ${formatNumber(player.ip, 1)}`;
  }
  return `AVG ${formatAvg(player.avg)} | HR ${player.hr ?? "-"} | RBI ${player.rbi ?? "-"} | SB ${player.sb ?? "-"} | AB ${player.ab ?? "-"}`;
}

// ── Sort-value accessors (pitcher / batter dispatch) ──────────────────

export function primaryRateSortValue(player: DraftPlayerPublic) {
  if (isPitcherOnly(player)) {
    return player.era === null || player.era === undefined ? 0 : -player.era;
  }
  return player.avg ?? 0;
}

export function powerSortValue(player: DraftPlayerPublic) {
  return isPitcherOnly(player) ? player.so ?? 0 : player.hr ?? 0;
}

export function productionSortValue(player: DraftPlayerPublic) {
  return isPitcherOnly(player) ? player.w ?? 0 : player.rbi ?? 0;
}

export function speedSortValue(player: DraftPlayerPublic) {
  return isPitcherOnly(player) ? player.sv ?? 0 : player.sb ?? 0;
}

// ── sessionStorage I/O (with legacy localStorage fallback) ────────────

export function removeUnsavedDraftStorage() {
  sessionStorage.removeItem(UNSAVED_DRAFT_KEY);
  localStorage.removeItem(UNSAVED_DRAFT_KEY);
}

// "현재 드래프트 페이지에서 보고 있는 세션 id" 를 페이지 간에 공유.
// My Team 페이지가 이를 우선 source-of-truth 로 써서 stale URL ?sessionId
// 때문에 옛 세션의 픽을 보여주는 문제를 막는다.
//   - 로드 모드 (/draft/:id) 진입 → setActiveDraftSessionId(id)
//   - 미저장 모드 / discard 후 빈 상태 / "New" 후 reset → setActiveDraftSessionId(null)
//   - 미저장을 저장(POST) 한 직후 → setActiveDraftSessionId(newId)
const ACTIVE_DRAFT_SESSION_KEY = "ppadun_active_draft_session_id";

export function setActiveDraftSessionId(id: number | null) {
  try {
    if (id === null) sessionStorage.removeItem(ACTIVE_DRAFT_SESSION_KEY);
    else sessionStorage.setItem(ACTIVE_DRAFT_SESSION_KEY, String(id));
  } catch {
    // quota / privacy mode — 무시
  }
}

export function getActiveDraftSessionId(): number | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_DRAFT_SESSION_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function readUnsavedDraftStorage(): string | null {
  const current = sessionStorage.getItem(UNSAVED_DRAFT_KEY);
  if (current) return current;

  const legacy = localStorage.getItem(UNSAVED_DRAFT_KEY);
  if (!legacy) return null;

  // Migrate legacy localStorage payload into the per-tab sessionStorage.
  sessionStorage.setItem(UNSAVED_DRAFT_KEY, legacy);
  localStorage.removeItem(UNSAVED_DRAFT_KEY);
  return legacy;
}

// ── Data shaping ──────────────────────────────────────────────────────

// 미저장 모드에서 config 만으로 teams 배열을 만든다.
// 저장 시 서버가 자체 ID 로 다시 만들어 주므로 여기 ID 는 클라이언트 임시 키.
export function buildTeamsFromConfig(config: DraftConfigServer): DraftTeam[] {
  const teams: DraftTeam[] = [
    { id: "team-0", name: config.myTeamName, isMine: true },
  ];
  for (let i = 0; i < config.opponentsCount; i += 1) {
    teams.push({
      id: `team-${i + 1}`,
      name: config.oppTeamNames[i] ?? `Opponent ${i + 1}`,
      isMine: false,
    });
  }
  return teams;
}

export function normalizeDraftTeamId(teamId: string) {
  if (teamId === "me" || teamId === "team-me") return "team-0";
  const legacyOpponent = /^opp(\d+)$/.exec(teamId);
  if (legacyOpponent) return `team-${Number(legacyOpponent[1]) + 1}`;
  return teamId;
}

export function normalizeDraftPicks(picks: DraftPick[]): DraftPick[] {
  return picks.map((pick) => ({
    ...pick,
    draftedByTeamId: normalizeDraftTeamId(pick.draftedByTeamId),
    // 옛 localStorage / 세션엔 kind 가 없을 수 있어 main 폴백.
    kind: pick.kind ?? "main",
  }));
}

// 공개 선수 목록과 인증 값 목록을 playerId 기준으로 머지
export function mergePlayersWithValues(
  publicPlayers: DraftPlayerPublic[],
  values: DraftPlayerValue[] | null,
): DraftPlayer[] {
  if (!values) return publicPlayers.map((player) => ({ ...player }));

  const valueById = new Map(values.map((v) => [v.playerId, v]));
  return publicPlayers.map((player) => {
    const v = valueById.get(player.id);
    return v
      ? { ...player, ppaValue: v.ppaValue, recommendedBid: v.recommendedBid }
      : { ...player };
  });
}

// "Untitled Draft" 같은 자동 이름은 Save 모달에서 빈 입력으로 시작해야 한다.
export function initialNameFor(currentName: string | null): string {
  if (!currentName) return "";
  if (currentName === "Untitled Draft") return "";
  return currentName;
}
