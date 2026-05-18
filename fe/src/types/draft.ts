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

  // ── 타자 스탯 ────────────────────────────────────────────────────────
  ab: number | null;             // 타수
  r: number | null;              // 득점 (타자) / 실점 (투수)
  h: number | null;              // 안타 (타자) / 피안타 (투수)
  single: number | null;         // 1루타
  double: number | null;         // 2루타
  triple: number | null;         // 3루타
  hr: number | null;             // 홈런 (타자) / 피홈런 (투수)
  rbi: number | null;            // 타점
  bb: number | null;             // 볼넷 (타자) / 볼넷 허용 (투수)
  k: number | null;              // 삼진
  sb: number | null;             // 도루
  cs: number | null;             // 도루 실패
  avg: number | null;            // 타율
  obp: number | null;            // 출루율
  slg: number | null;            // 장타율

  // ── 투수 스탯 (h, r, hr, bb 는 위와 공유 — 문맥에 따라 의미가 달라짐) ──
  w: number | null;              // 승
  l: number | null;              // 패
  sv: number | null;             // 세이브
  so: number | null;             // 탈삼진
  era: number | null;            // 평균자책점
  whip: number | null;           // WHIP
  ip: number | null;             // 이닝 (소수점은 1/3 단위 표기 — 184.2 = 184 2/3)
  g: number | null;              // 등판
  gs: number | null;             // 선발 등판
  war: number | null;            // WAR
  fip: number | null;            // FIP
  er: number | null;             // 자책점
  hbp: number | null;            // 사구
  bf: number | null;             // 상대 타자 수
  era_plus: number | null;       // 조정 ERA (ERA+)
  h9: number | null;             // 9이닝당 피안타
  hr9: number | null;             // 9이닝당 피홈런
  bb9: number | null;             // 9이닝당 볼넷
  so9: number | null;             // 9이닝당 탈삼진
  so_bb: number | null;           // K/BB 비율
};

/**
 * DraftPlayerValue: 인증 필요 GET /api/draft/players/value 가 돌려주는 가치 정보
 * - playerId 를 키로 DraftPlayerPublic 과 머지해서 DraftPlayer 를 구성
 * - recommendedBid 는 모달에서 단건으로 따로 호출 (DraftPlayerBid)
 */
export type DraftPlayerValue = {
  playerId: string;
  ppaValue: number | null;       // PPA-DUN 가치 점수
};

/**
 * DraftPlayerBid: POST /api/draft/players/bid 단건 응답
 * - Add 버튼 클릭 시 모달이 열리는 동안 즉석에서 호출
 */
export type DraftPlayerBid = {
  playerId: string;
  recommendedBid: number | null;
};

/**
 * DraftPlayer: UI 에서 사용하는 머지된 선수 타입
 * - ppaValue 는 일괄 fetch 로 채워짐. recommendedBid 는 머지 흐름에서 채우지 않음 (모달 props 로 전달).
 *   타입은 호환성을 위해 optional 로 남겨두지만, mergePlayersWithValues 는 더 이상 세팅하지 않는다.
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
 * ContractCode: keeper / contract 상태. 영입 당시 사용자가 고른 원본 값.
 * 화면에 표시할 때는 (targetSeason − signedSeason) 만큼 깎아서 동적 계산.
 *   F3/F2/F1 = Free Agent (3/2/1년 남음)
 *   S1       = 단년 계약
 *   L2/LX    = 장기 계약 (2년 남음 / 만료 상태)
 *   X        = 만료 / 비보호
 */
export type ContractCode = "F3" | "F2" | "F1" | "S1" | "L2" | "LX" | "X";

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
  contractCode?: ContractCode | null;  // 영입 당시 keeper 계약 코드 (옛 픽은 null)
  signedSeason?: number | null;        // 영입 세션의 targetSeason (옛 픽은 null)
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
  targetSeason?: number;         // keeper 롤오버의 기준 시즌 (예: 2027)
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
  targetSeason?: number | null;  // 옛 세션은 null/undefined일 수 있음
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
 * PlayerNote: 선수 메모. 세션당 (session_id, player_id) 조합으로 유니크.
 * - GET /api/draft/sessions/{id}/notes 응답 items 요소
 */
export type PlayerNote = {
  playerId: string;
  note: string;
  updatedAt: string;
};

/**
 * DraftSort: 드래프트 페이지의 정렬 옵션
 * - _desc: 내림차순 (높은 것부터)
 * - _asc: 오름차순
 */
export type DraftSort =
  | "score_desc"
  | "score_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";

/**
 * DraftPositionFilter: 포지션 필터 옵션
 * - "ALL" 은 의도적으로 제외 — 타자/투수 스탯이 분리되어 한 화면에 섞으면
 *   빈 컬럼이 생기기 때문 ("pick 5 stat columns" 기능 대비).
 * - "P" 는 의도적으로 제외 — 투수는 SP / RP 로만 필터.
 */
export type DraftPositionFilter =
  | "SP"       // 선발 투수
  | "RP"       // 구원 투수
  | "C"        // 포수
  | "1B"       // 1루수
  | "2B"       // 2루수
  | "3B"       // 3루수
  | "SS"       // 유격수
  | "OF"       // 외야수
  | "UTIL";    // 유틸리티
