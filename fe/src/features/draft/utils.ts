import type {
  DraftConfig,
  DraftPick,
  DraftPlayer,
  DraftPosition,
  DraftPositionFilter,
  DraftSort,
  DraftTeam,
} from "../../types/draft";

const DEFAULT_CONFIG: DraftConfig = {
  leagueType: "standard",
  budget: 260,
  rosterPlayers: 23,
  myTeamName: "PPA-DUN",
  oppTeamName: "Rivals",
};

export function readDraftConfig(): DraftConfig {
  try {
    const raw = localStorage.getItem("ppadun_draft_config");
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DraftConfig>;
    return {
      leagueType: parsed.leagueType ?? DEFAULT_CONFIG.leagueType,
      budget: clampNumber(parsed.budget, 50, 600, DEFAULT_CONFIG.budget),
      rosterPlayers: clampRosterSize(parsed.rosterPlayers),
      myTeamName: parsed.myTeamName?.trim() || DEFAULT_CONFIG.myTeamName,
      oppTeamName: parsed.oppTeamName?.trim() || DEFAULT_CONFIG.oppTeamName,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function clampRosterSize(input: number | undefined): number {
  return clampNumber(input, 12, 35, DEFAULT_CONFIG.rosterPlayers);
}

export function buildSlotTemplate(rosterSlots: number): DraftPosition[] {
  const base: DraftPosition[] = [
    "C",
    "1B",
    "2B",
    "3B",
    "SS",
    "OF",
    "OF",
    "OF",
    "UTIL",
    "SP",
    "SP",
    "SP",
    "RP",
    "RP",
  ];

  if (rosterSlots <= base.length) return base.slice(0, rosterSlots);
  return [...base, ...new Array<DraftPosition>(rosterSlots - base.length).fill("BENCH")];
}

export function seedInitialPicks(_teams: DraftTeam[], _slotTemplate: DraftPosition[]): DraftPick[] {
  return [];
}

export function calculateRemainingBudget(
  totalBudget: number,
  myTeamId: string,
  picks: DraftPick[]
): number {
  const spent = picks
    .filter((p) => p.draftedByTeamId === myTeamId && p.bid !== null)
    .reduce((sum, p) => sum + (p.bid ?? 0), 0);
  return Math.max(0, totalBudget - spent);
}

export function calculateCurrentRound(
  teamCount: number,
  rosterSlots: number,
  picks: DraftPick[]
): number {
  if (teamCount <= 0) return 1;
  const round = Math.floor(picks.length / teamCount) + 1;
  return Math.min(Math.max(round, 1), rosterSlots);
}

export function filterDraftPlayers(
  players: DraftPlayer[],
  query: string,
  position: DraftPositionFilter
): DraftPlayer[] {
  const q = query.trim().toLowerCase();
  return players.filter((p) => {
    const queryOk =
      q.length === 0 ||
      p.name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.positions.some((pos) => pos.toLowerCase().includes(q));
    const posOk = position === "ALL" || p.positions.includes(position);
    return queryOk && posOk;
  });
}

export function sortDraftPlayers(players: DraftPlayer[], sort: DraftSort): DraftPlayer[] {
  const out = [...players];
  const numeric = (value: number | undefined) => value ?? -1;
  out.sort((a, b) => {
    switch (sort) {
      case "score_desc":
        return b.ppaValue - a.ppaValue;
      case "score_asc":
        return a.ppaValue - b.ppaValue;
      case "cost_desc":
        return b.recommendedBid - a.recommendedBid;
      case "cost_asc":
        return a.recommendedBid - b.recommendedBid;
      case "avg_desc":
        return numeric(b.avg) - numeric(a.avg);
      case "hr_desc":
        return numeric(b.hr) - numeric(a.hr);
      case "rbi_desc":
        return numeric(b.rbi) - numeric(a.rbi);
      case "sb_desc":
        return numeric(b.sb) - numeric(a.sb);
      default:
        return 0;
    }
  });
  return out;
}

export function formatAvg(avg: number | undefined): string {
  if (!avg || avg <= 0) return "—";
  return avg.toFixed(3).replace(/^0/, "");
}

export function valueClass(value: number, authed: boolean): string {
  if (!authed) return "text-white/25 blur-[1px]";
  if (value >= 90) return "text-emerald-300";
  if (value >= 80) return "text-sky-300";
  if (value >= 70) return "text-amber-300";
  return "text-white/70";
}

export function draftCostClass(authed: boolean): string {
  return authed ? "font-black text-emerald-300" : "text-white/25 blur-[1px]";
}

export function mlbTeamBadgeClass(team: string): string {
  const key = team.toUpperCase();
  if (key === "LAD") return "border-blue-400/30 bg-blue-500/15 text-blue-200";
  if (key === "NYY") return "border-slate-300/30 bg-slate-500/15 text-slate-200";
  if (key === "BAL") return "border-orange-300/30 bg-orange-500/15 text-orange-200";
  if (key === "PHI") return "border-red-300/30 bg-red-500/15 text-red-200";
  if (key === "NYM") return "border-cyan-300/30 bg-cyan-500/15 text-cyan-200";
  return "border-white/20 bg-white/10 text-white/80";
}

export function getPlayerDraftStatus(
  playerId: string,
  picks: DraftPick[],
  teams: DraftTeam[]
): { kind: "available" | "mine" | "taken"; label: string } {
  const pick = picks.find((p) => p.playerId === playerId);
  if (!pick) return { kind: "available", label: "Available" };
  const team = teams.find((t) => t.id === pick.draftedByTeamId);
  if (team?.isMine) return { kind: "mine", label: "Added" };
  return { kind: "taken", label: `Taken (${team?.name ?? "Other"})` };
}

export function getAllowedPositionsForPlayer(
  teamId: string,
  player: DraftPlayer,
  slotTemplate: DraftPosition[],
  picks: DraftPick[]
): DraftPosition[] {
  const allowed = player.positions.filter((pos) =>
    slotTemplate.some((slotPos, slotIndex) => {
      if (slotPos !== pos) return false;
      return !picks.some((p) => p.draftedByTeamId === teamId && p.slotIndex === slotIndex);
    })
  );

  const hasBench = slotTemplate.some((slotPos, slotIndex) => {
    if (slotPos !== "BENCH") return false;
    return !picks.some((p) => p.draftedByTeamId === teamId && p.slotIndex === slotIndex);
  });

  if (hasBench) allowed.push("BENCH");
  if (allowed.includes("UTIL")) return dedupePositions(allowed);

  const isHitter = player.positions.some((pos) => !["SP", "RP"].includes(pos));
  const utilOpen = slotTemplate.some((slotPos, slotIndex) => {
    if (slotPos !== "UTIL") return false;
    return !picks.some((p) => p.draftedByTeamId === teamId && p.slotIndex === slotIndex);
  });

  if (isHitter && utilOpen) allowed.push("UTIL");
  return dedupePositions(allowed);
}

export function findAvailableSlotIndex(
  teamId: string,
  selectedPos: string,
  slotTemplate: DraftPosition[],
  picks: DraftPick[]
): number {
  const target = selectedPos as DraftPosition;
  for (let i = 0; i < slotTemplate.length; i += 1) {
    if (slotTemplate[i] !== target) continue;
    const occupied = picks.some((p) => p.draftedByTeamId === teamId && p.slotIndex === i);
    if (!occupied) return i;
  }
  return -1;
}

function dedupePositions(positions: DraftPosition[]): DraftPosition[] {
  return Array.from(new Set(positions));
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
