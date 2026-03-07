import type {
  DraftConfigLocal,
  DraftPick,
  DraftPlayer,
  DraftPositionFilter,
  DraftSort,
  DraftTeam,
} from "../../types/draft";

export function readDraftConfig(): DraftConfigLocal {
  try {
    const raw = localStorage.getItem("ppadun_draft_config");
    if (!raw) {
      return {
        myTeamName: "My Team",
        oppTeamName: "Team A",
        leagueType: "standard",
        budget: 260,
        rosterPlayers: 12,
      };
    }
    const parsed = JSON.parse(raw) as DraftConfigLocal;
    return {
      myTeamName: parsed.myTeamName || "My Team",
      oppTeamName: parsed.oppTeamName || "Team A",
      leagueType: parsed.leagueType || "standard",
      budget: parsed.budget ?? 260,
      rosterPlayers: parsed.rosterPlayers ?? 12,
      createdAt: parsed.createdAt,
    };
  } catch {
    return {
      myTeamName: "My Team",
      oppTeamName: "Team A",
      leagueType: "standard",
      budget: 260,
      rosterPlayers: 12,
    };
  }
}

export function clampRosterSize(n?: number) {
  const value = n ?? 12;
  return Math.min(Math.max(value, 8), 25);
}

// 포지션이 보이는 슬롯 템플릿
export function buildSlotTemplate(count: number): string[] {
  const base = [
    "SP",
    "RP",
    "C",
    "1B",
    "2B",
    "3B",
    "SS",
    "LF",
    "CF",
    "RF",
    "DH",
    "UTIL",
    "UTIL",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
  ];
  return base.slice(0, count);
}

export function filterDraftPlayers(
  players: DraftPlayer[],
  query: string,
  position: DraftPositionFilter
) {
  const q = query.trim().toLowerCase();

  return players.filter((p) => {
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q);

    const matchesPos =
      position === "ALL" ? true : p.positions.includes(position);

    return matchesQuery && matchesPos;
  });
}

export function sortDraftPlayers(players: DraftPlayer[], sort: DraftSort) {
  const copy = [...players];

  switch (sort) {
    case "score_desc":
      return copy.sort((a, b) => b.ppaValue - a.ppaValue);
    case "score_asc":
      return copy.sort((a, b) => a.ppaValue - b.ppaValue);
    case "cost_desc":
      return copy.sort((a, b) => b.recommendedBid - a.recommendedBid);
    case "cost_asc":
      return copy.sort((a, b) => a.recommendedBid - b.recommendedBid);
    case "avg_desc":
      return copy.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    case "hr_desc":
      return copy.sort((a, b) => (b.hr ?? 0) - (a.hr ?? 0));
    case "rbi_desc":
      return copy.sort((a, b) => (b.rbi ?? 0) - (a.rbi ?? 0));
    case "sb_desc":
      return copy.sort((a, b) => (b.sb ?? 0) - (a.sb ?? 0));
    default:
      return copy;
  }
}

export function teamAccentClass(team: DraftTeam, index: number) {
  if (team.isMine) {
    return {
      header: "border-sky-400/30 bg-sky-500/10 text-sky-200",
      slot: "border-sky-400/20 bg-sky-500/8",
      text: "text-sky-200",
    };
  }

  const palette = [
    { header: "border-rose-400/30 bg-rose-500/10 text-rose-200", slot: "border-rose-400/20 bg-rose-500/8", text: "text-rose-200" },
    { header: "border-amber-400/30 bg-amber-500/10 text-amber-200", slot: "border-amber-400/20 bg-amber-500/8", text: "text-amber-200" },
    { header: "border-violet-400/30 bg-violet-500/10 text-violet-200", slot: "border-violet-400/20 bg-violet-500/8", text: "text-violet-200" },
    { header: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", slot: "border-emerald-400/20 bg-emerald-500/8", text: "text-emerald-200" },
    { header: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200", slot: "border-cyan-400/20 bg-cyan-500/8", text: "text-cyan-200" },
    { header: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200", slot: "border-fuchsia-400/20 bg-fuchsia-500/8", text: "text-fuchsia-200" },
  ];

  return palette[index % palette.length];
}

export function mlbTeamBadgeClass(team: string): string {
  const t = team.toUpperCase();
  const map: Record<string, string> = {
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
  return map[t] ?? "bg-white/10 text-white/80 border-white/15";
}

export function formatAvg(avg: number | null) {
  if (!avg) return "—";
  return avg.toFixed(3).replace("0.", ".");
}

export function valueClass(v: number, authed: boolean) {
  if (!authed) return "blur-sm select-none text-emerald-400/60";
  if (v >= 10) return "text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.55)]";
  return "text-emerald-400";
}

export function draftCostClass(authed: boolean) {
  return authed ? "text-white/80" : "blur-sm select-none text-white/50";
}

export function findAvailableSlotIndex(
  teamId: string,
  desiredPos: string,
  slotTemplate: string[],
  picks: DraftPick[]
) {
  const occupied = new Set(
    picks.filter((p) => p.draftedByTeamId === teamId).map((p) => p.slotIndex)
  );

  // 1) 정확한 포지션 슬롯
  for (let i = 0; i < slotTemplate.length; i++) {
    if (occupied.has(i)) continue;
    if (slotTemplate[i] === desiredPos) return i;
  }

  // 2) UTIL
  for (let i = 0; i < slotTemplate.length; i++) {
    if (occupied.has(i)) continue;
    if (slotTemplate[i] === "UTIL") return i;
  }

  // 3) BN
  for (let i = 0; i < slotTemplate.length; i++) {
    if (occupied.has(i)) continue;
    if (slotTemplate[i] === "BN") return i;
  }

  return -1;
}

export function getAllowedPositionsForPlayer(
  teamId: string,
  player: DraftPlayer,
  slotTemplate: string[],
  picks: DraftPick[]
) {
  return player.positions.filter((pos) => findAvailableSlotIndex(teamId, pos, slotTemplate, picks) !== -1);
}

export function calculateRemainingBudget(budget: number, myTeamId: string, picks: DraftPick[]) {
  const spent = picks
    .filter((p) => p.draftedByTeamId === myTeamId && typeof p.bid === "number")
    .reduce((sum, p) => sum + (p.bid ?? 0), 0);
  return Math.max(0, budget - spent);
}

export function calculateCurrentRound(teamCount: number, rosterSlots: number, picks: DraftPick[]) {
  const totalPicks = picks.length;
  const round = Math.min(rosterSlots, Math.floor(totalPicks / teamCount) + 1);
  return round;
}

export function getPlayerDraftStatus(playerId: string, picks: DraftPick[], teams: DraftTeam[]) {
  const hit = picks.find((p) => p.playerId === playerId);
  if (!hit) {
    return { kind: "available" as const };
  }

  const team = teams.find((t) => t.id === hit.draftedByTeamId);
  if (hit.type === "mine") {
    return {
      kind: "mine" as const,
      label: `✓ My Pick - $${hit.bid ?? "?"}`,
      teamName: team?.name ?? "My Team",
    };
  }

  return {
    kind: "taken" as const,
    label: `${team?.name ?? "Taken"} - $${hit.bid ?? "?"}`,
    teamName: team?.name ?? "Taken",
  };
}

export function seedInitialPicks(
  teams: DraftTeam[],
  slotTemplate: string[]
): DraftPick[] {
  const seed = [
    { playerId: "p1", teamId: teams[0]?.id, bid: 25, slotPos: "DH", type: "mine" as const },
    { playerId: "p2", teamId: teams[0]?.id, bid: 12, slotPos: "RF", type: "mine" as const },
    { playerId: "p3", teamId: teams[1]?.id, bid: 75, slotPos: "LF", type: "taken" as const },
    { playerId: "p6", teamId: teams[2]?.id, bid: 24, slotPos: "SS", type: "taken" as const },
  ];

  const picks: DraftPick[] = [];

  for (const s of seed) {
    if (!s.teamId) continue;
    const slotIndex = findAvailableSlotIndex(s.teamId, s.slotPos, slotTemplate, picks);
    if (slotIndex === -1) continue;

    picks.push({
      playerId: s.playerId,
      draftedByTeamId: s.teamId,
      slotIndex,
      slotPos: s.slotPos,
      bid: s.bid,
      type: s.type,
    });
  }

  return picks;
}