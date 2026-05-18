import type { MyTeamPlayer, MyTeamPosFilter, MyTeamSort } from "../../types/myteam";

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
 * 선수 목록 필터링
 * - 이름/팀명 검색 (대소문자 무시)
 * - 포지션 필터 (ALL이면 전체)
 * - BENCH(1B) 같은 포맷도 포지션 문자열에 포함되면 매칭
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

/** 선수 목록 정렬 (정렬 옵션별 비교 함수 적용) */
export function sortMyTeam(players: MyTeamPlayer[], sort: MyTeamSort): MyTeamPlayer[] {
  // 원본 배열을 변경하지 않도록 복사본 사용
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

/** 타율을 .300 같은 야구식 표기로 포맷 (0이면 "-") */
export function formatAvg(avg: number) {
  if (!avg) return "-";
  return avg.toFixed(3).replace("0.", ".");
}

