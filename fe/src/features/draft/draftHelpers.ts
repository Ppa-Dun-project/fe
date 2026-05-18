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
import { getStatDef } from "./statColumns";

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

// Build the Sort dropdown options dynamically — "By Score" always first, then one
// option per currently-selected stat slot (null slots skipped). Pure function so
// it can be memoized in the page component.
export function buildSortOptions(
  statKeys: readonly (string | null)[],
): { value: DraftSort; label: string }[] {
  const opts: { value: DraftSort; label: string }[] = [
    { value: "score_desc", label: "By Score" },
  ];
  for (const key of statKeys) {
    if (key === null) continue;
    const def = getStatDef(key);
    if (!def) continue;
    opts.push({ value: `stat:${key}` as DraftSort, label: `By ${def.label}` });
  }
  return opts;
}

// ── Inline API response & sessionStorage payload types ────────────────

export type DraftPlayersResponse = { items: DraftPlayerPublic[] };
export type DraftPlayerValuesResponse = { items: DraftPlayerValue[] };
export type SessionsListResponse = { items: SessionSummary[] };

// sessionStorage payload — written by DraftSetupCard and read by DraftPage.
// Persists across navigation/refresh within the same tab only; cleared when the window is closed.
export type UnsavedDraft = {
  config: DraftConfigServer;
  picks: DraftPick[];
  notes?: Record<string, string>; // playerId → note (client-side storage before save)
};

// ── Filtering / predicates ────────────────────────────────────────────

// All filters require an exact position match — the UTIL chip selects only players who are UTIL-eligible.
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

// Compare feature — only allows comparisons within the same category.
// Batters/catchers/utility players all have playerType !== "pitcher", so they form one group.
// SP/RP belong to the playerType === "pitcher" group.
export function arePlayersComparable(
  a: DraftPlayerPublic,
  b: DraftPlayerPublic,
): boolean {
  return isPitcherOnly(a) === isPitcherOnly(b);
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

// Shares "the session id currently being viewed on the draft page" across pages.
// The My Team page treats this as the primary source-of-truth, which prevents it from
// showing picks from an old session due to a stale URL ?sessionId.
//   - Entering loaded mode (/draft/:id) → setActiveDraftSessionId(id)
//   - Unsaved mode / empty state after discard / reset after "New" → setActiveDraftSessionId(null)
//   - Immediately after saving (POST) an unsaved draft → setActiveDraftSessionId(newId)
const ACTIVE_DRAFT_SESSION_KEY = "ppadun_active_draft_session_id";

export function setActiveDraftSessionId(id: number | null) {
  try {
    if (id === null) sessionStorage.removeItem(ACTIVE_DRAFT_SESSION_KEY);
    else sessionStorage.setItem(ACTIVE_DRAFT_SESSION_KEY, String(id));
  } catch {
    // quota / privacy mode — ignore
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

// In unsaved mode, builds the teams array purely from the config.
// On save, the server regenerates these with its own IDs, so the IDs here are just client-side temporary keys.
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
    // Older localStorage / sessions may not have `kind`, so fall back to "main".
    kind: pick.kind ?? "main",
  }));
}

// Merges the public players list with the authenticated values list by playerId.
export function mergePlayersWithValues(
  publicPlayers: DraftPlayerPublic[],
  values: DraftPlayerValue[] | null,
): DraftPlayer[] {
  if (!values) return publicPlayers.map((player) => ({ ...player }));

  const valueById = new Map(values.map((v) => [v.playerId, v]));
  return publicPlayers.map((player) => {
    const v = valueById.get(player.id);
    return v ? { ...player, ppaValue: v.ppaValue } : { ...player };
  });
}

// Auto-generated names like "Untitled Draft" should start as an empty input in the Save modal.
export function initialNameFor(currentName: string | null): string {
  if (!currentName) return "";
  if (currentName === "Untitled Draft") return "";
  return currentName;
}
