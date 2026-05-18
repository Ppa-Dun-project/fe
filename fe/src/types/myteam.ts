/**
 * MyTeamPlayer: 내 팀에 드래프트된 선수
 * - DraftPlayer와 유사하지만 필드가 약간 다름 (cost 포함)
 */
export type MyTeamPlayer = {
  id: string;
  name: string;
  playerType: "batter" | "pitcher";
  pos: string;            // 포지션 (단일)
  cost: number;           // 낙찰가 ($)
  team: string;           // MLB 팀
  avg: number;            // 타율
  hr: number;             // 홈런
  rbi: number;            // 타점
  sb: number;             // 도루
  w?: number | null;
  sv?: number | null;
  so?: number | null;
  era?: number | null;
  whip?: number | null;
  ip?: number | null;
  ppaValue: number;       // PPA-DUN 점수
};

/**
 * MyTeamPosFilter: 내 팀 페이지의 포지션 필터
 * - DraftPositionFilter보다 세분화됨 (LF, RF, CF, DH 포함)
 */
export type MyTeamPosFilter =
  | "ALL"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "OF"
  | "UTIL"
  | "LF"       // 좌익수
  | "RF"       // 우익수
  | "CF"       // 중견수
  | "DH"       // 지명타자
  | "SP"
  | "RP";

/**
 * MyTeamSort: 내 팀 페이지 정렬 옵션
 */
export type MyTeamSort =
  | "score_desc"
  | "score_asc"
  | "cost_desc"
  | "cost_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";
