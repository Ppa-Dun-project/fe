import type { MyTeamPlayer } from "../../types/myteam";

// ✅ 프론트 MVP용 mock 데이터
// TODO(백엔드/DB): 드래프트 결과(영입 선수) 테이블/엔드포인트에서 이 데이터를 내려줘야 함.
// 예) GET /api/my-team/players  (userId 기반)
export const mockMyTeamPlayers: MyTeamPlayer[] = [
  {
    id: "p1",
    name: "Shohei Ohtani",
    pos: "DH",
    cost: 25,
    team: "LAA",
    avg: 0.394,
    hr: 54,
    rbi: 130,
    sb: 26,
    ppaValue: 9.2,
  },
  {
    id: "p2",
    name: "Aaron Judge",
    pos: "RF",
    cost: 12,
    team: "NYY",
    avg: 0.322,
    hr: 98,
    rbi: 144,
    sb: 3,
    ppaValue: 10.6,
  },
  {
    id: "p3",
    name: "Juan Soto",
    pos: "LF",
    cost: 75,
    team: "NYM",
    avg: 0.288,
    hr: 41,
    rbi: 109,
    sb: 7,
    ppaValue: 7.1,
  },
  {
    id: "p4",
    name: "José Ramírez",
    pos: "3B",
    cost: 11,
    team: "CLE",
    avg: 0.279,
    hr: 39,
    rbi: 118,
    sb: 20,
    ppaValue: 7.5,
  },
  {
    id: "p5",
    name: "Bobby Witt Jr.",
    pos: "SS",
    cost: 24,
    team: "KC",
    avg: 0.302,
    hr: 30,
    rbi: 103,
    sb: 49,
    ppaValue: 7.0,
  },
  {
    id: "p6",
    name: "Zack Wheeler",
    pos: "SP",
    cost: 34,
    team: "PHI",
    avg: 0.0,
    hr: 0,
    rbi: 0,
    sb: 0,
    ppaValue: 6.2,
  },
];

// 포지션 필터 버튼(스크린샷 느낌)
export const myTeamPositions = [
  "ALL",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "RF",
  "CF",
  "DH",
  "SP",
  "RP",
] as const;

export type MyTeamPosFilter = (typeof myTeamPositions)[number];