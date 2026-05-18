import type { MyTeamPlayer, MyTeamPosFilter, MyTeamSort } from "../../types/myteam";
import type {
  DraftPick,
  DraftPlayerPublic,
  DraftPlayerValue,
} from "../../types/draft";
import type { UnsavedDraft } from "../draft/draftHelpers";

// 백엔드 MyTeamPlayersResponse 와 동일한 shape (myteam.py)
export type MyTeamSynthesized = {
  items: MyTeamPlayer[];
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
};

// 미저장 드래프트 (sessionStorage) 를 백엔드 my-team 응답과 동일한 shape 로 합성.
// 백엔드 pick_my_players + get_budget_summary 의 클라이언트 미러 — 저장 전이라도
// My Team 페이지가 실시간 픽을 반영하도록.
export function synthesizeUnsavedMyTeam(
  unsaved: UnsavedDraft,
  publicPlayers: DraftPlayerPublic[],
  values: DraftPlayerValue[] | null,
): MyTeamSynthesized {
  // main 픽만 — 백엔드는 모든 kind 를 가져오지만 minor/taxi 는 slotPos === null
  // 이라 pos: string 매핑이 불가능. 메인 로스터만 표시하는 게 의미적으로도 일치.
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
  // SP/RP 슬롯이면 투수로 취급 (two_way 포함). 그 외엔 player.playerType 그대로.
  const isPitcherSlot = pick.slotPos === "SP" || pick.slotPos === "RP";
  const playerType: "batter" | "pitcher" =
    player.playerType === "pitcher" || (player.playerType === "two_way" && isPitcherSlot)
      ? "pitcher"
      : "batter";

  // 백엔드 mirror: BENCH 면 원본 포지션을 괄호 안에, DH/TWP 는 UTIL 로 흡수.
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

