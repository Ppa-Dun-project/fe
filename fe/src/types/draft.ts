/**
 * DraftPlayerPublic: 공개 /api/draft/players 가 돌려주는 선수 기본 정보
 * - PPA-DUN 값과 추천 드래프트 비용은 포함되지 않음 (인증 사용자 전용 엔드포인트에서 별도 제공)
 */
export type DraftPlayerPublic = {
  id: string;
  name: string;
  playerType: "batter" | "pitcher" | "two_way";
  team: string;                  // MLB 팀 약어 (예: "NYY")
  positions: string[];           // 포지션 배열 (예: ["OF", "DH"])
  avg: number | null;            // 타율
  hr: number | null;             // 홈런
  rbi: number | null;            // 타점
  sb: number | null;             // 도루
  ab: number | null;             // 타석
  w: number | null;
  sv: number | null;
  so: number | null;
  era: number | null;
  whip: number | null;
  ip: number | null;
};

/**
 * DraftPlayerValue: 인증 필요 /api/draft/players/values 가 돌려주는 가치 정보
 * - playerId 를 키로 DraftPlayerPublic 과 머지해서 DraftPlayer 를 구성
 */
export type DraftPlayerValue = {
  playerId: string;
  ppaValue: number | null;       // PPA-DUN 가치 점수
  recommendedBid: number | null; // 추천 드래프트 비용
};

/**
 * DraftPlayer: UI 에서 사용하는 머지된 선수 타입
 * - 비로그인 또는 값 조회 실패 시 ppaValue / recommendedBid 가 undefined 가 될 수 있음
 * - 표시 시점에 formatPpa() / ?? 등으로 방어 필요
 */
export type DraftPlayer = DraftPlayerPublic & {
  ppaValue?: number | null;
  recommendedBid?: number | null;
};

/**
 * DraftTeam: 드래프트 룸에 참여하는 팀
 */
export type DraftTeam = {
  id: string;
  name: string;
  isMine?: boolean;              // 내 팀인지 여부 (선택)
};

/**
 * DraftPickType: 드래프트 픽의 종류
 * - 유니온 타입: 두 값 중 하나만 가능
 */
export type DraftPickType = "mine" | "taken";

/**
 * DraftPickKind: 어느 보드에 속한 픽인지 구분
 * - main: 일반 드래프트 (포지션 슬롯 + bid)
 * - minor / taxi: 메인 드래프트 전/후로 따로 잡는 무료 픽. 포지션·bid 없음.
 */
export type DraftPickKind = "main" | "minor" | "taxi";

/**
 * DraftPick: 개별 드래프트 픽 정보
 */
export type DraftPick = {
  playerId: string;              // 뽑은 선수 ID
  draftedByTeamId: string;       // 뽑은 팀 ID
  slotIndex: number;             // 로스터 슬롯 번호
  slotPos: string | null;        // 슬롯 포지션 — 마이너/택시는 null
  bid: number | null;            // 낙찰가 ($) — 마이너/택시는 null
  type: DraftPickType;           // "mine" 또는 "taken"
  kind: DraftPickKind;           // "main" | "minor" | "taxi"
};

/**
 * DraftConfigLocal: 드래프트 설정 (localStorage에 저장)
 * - HomePage에서 유저가 입력 → 드래프트 룸 진입 시 사용
 */
export type DraftConfigLocal = {
  myTeamName?: string;
  oppTeamNames?: string[];       // 상대 팀 이름들
  opponentsCount?: number;       // 상대 수
  leagueType?: string;           // "AL" | "NL" | "custom" (옛 세션은 "standard"|"lite" 가능 — fallback 처리)
  budget?: number;               // 예산 ($)
  rosterPlayers?: number;        // 로스터 인원
  rosterSlots?: RosterSlotCounts; // 포지션별 슬롯 수
  createdAt?: string;            // 설정 생성 시간
};

/**
 * DraftConfigServer: 백엔드 세션 응답에 들어 있는 config 형태
 * - DraftConfigLocal 과 달리 모든 필드가 필수 (서버가 정규화한 값)
 * - rosterSlots 는 옛 세션엔 없을 수 있어 선택적
 */
export type DraftConfigServer = {
  leagueType: string;
  budget: number;
  rosterPlayers: number;
  myTeamName: string;
  opponentsCount: number;
  oppTeamNames: string[];
  rosterSlots?: RosterSlotCounts;
};

/**
 * RosterSlotCounts: Draft Setup 모달에서 사용자가 정한 포지션별 슬롯 수.
 * 합계가 rosterPlayers 와 일치해야 Start Draft 가 활성화된다.
 */
export type RosterSlotPosition =
  | "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "UTIL" | "SP" | "RP" | "BENCH";
export type RosterSlotCounts = Record<RosterSlotPosition, number>;

/**
 * SessionSummary: GET /api/draft/sessions 의 각 항목 (Import 모달용)
 */
export interface SessionSummary {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

/**
 * SessionDetail: 단일 세션의 전체 데이터 (GET/POST/PUT 응답)
 */
export interface SessionDetail {
  id: number;
  name: string;
  config: DraftConfigServer;
  teams: DraftTeam[];
  picks: DraftPick[];
}

/**
 * DraftSort: 드래프트 페이지의 정렬 옵션
 * - _desc: 내림차순 (높은 것부터)
 * - _asc: 오름차순
 */
export type DraftSort =
  | "score_desc"
  | "score_asc"
  | "cost_desc"
  | "cost_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";

/**
 * DraftPositionFilter: 포지션 필터 옵션
 */
export type DraftPositionFilter =
  | "ALL"      // 전체
  | "P"        // 투수 전체 (SP + RP)
  | "SP"       // 선발 투수
  | "RP"       // 구원 투수
  | "C"        // 포수
  | "1B"       // 1루수
  | "2B"       // 2루수
  | "3B"       // 3루수
  | "SS"       // 유격수
  | "OF"       // 외야수
  | "UTIL";    // 유틸리티
