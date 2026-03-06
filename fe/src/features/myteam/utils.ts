import type { MyTeamPlayer } from "../../types/myteam";
import type { MyTeamPosFilter } from "./mock";

export type MyTeamSort =
  | "score_desc"
  | "score_asc"
  | "cost_desc"
  | "cost_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";

export function filterMyTeam(
  players: MyTeamPlayer[],
  query: string,
  pos: MyTeamPosFilter
): MyTeamPlayer[] {
  const q = query.trim().toLowerCase();

  return players.filter((p) => {
    const matchesQuery =
      !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
    const matchesPos = pos === "ALL" ? true : p.pos === pos;
    return matchesQuery && matchesPos;
  });
}

export function sortMyTeam(players: MyTeamPlayer[], sort: MyTeamSort): MyTeamPlayer[] {
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
      return copy.sort((a, b) => b.avg - a.avg);
    case "hr_desc":
      return copy.sort((a, b) => b.hr - a.hr);
    case "rbi_desc":
      return copy.sort((a, b) => b.rbi - a.rbi);
    case "sb_desc":
      return copy.sort((a, b) => b.sb - a.sb);
    default:
      return copy;
  }
}

export function formatAvg(avg: number) {
  if (!avg) return "—";
  return avg.toFixed(3).replace("0.", ".");
}

export function computeRemainingBudget(totalBudget: number, players: MyTeamPlayer[]) {
  const spent = players.reduce((sum, p) => sum + (p.cost ?? 0), 0);
  return Math.max(0, totalBudget - spent);
}

/** ✅ 팀별 “연한 색” 배지 스타일 (원하면 팀 추가 가능) */
export function teamBadgeClass(team: string): string {
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
    KC:  "bg-cyan-500/15 text-cyan-200 border-cyan-400/25",
    SD:  "bg-yellow-500/15 text-yellow-200 border-yellow-400/25",
    TEX: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
    BAL: "bg-orange-500/15 text-orange-200 border-orange-400/25",
    CIN: "bg-red-500/15 text-red-200 border-red-400/25",
    SEA: "bg-teal-500/15 text-teal-200 border-teal-400/25",
  };

  return map[t] ?? "bg-white/10 text-white/80 border-white/15";
}

/** ✅ PPA-DUN Value 강조: 10 이상이면 특별히 도드라지게 */
export function valueScoreClass(value: number): string {
  if (value >= 10) {
    return "text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.55)]";
  }
  return "text-emerald-400";
}