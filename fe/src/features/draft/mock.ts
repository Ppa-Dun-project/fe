import type { DraftPlayer, DraftTeam, DraftPositionFilter } from "../../types/draft";

export const draftPositionFilters: DraftPositionFilter[] = [
  "ALL",
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
];

// TODO(백엔드/DB): Draft 페이지 선수 목록은 DB/API 데이터로 교체 필요
// 예) GET /api/players?query=&position=&sort=&page=&limit=
export const mockDraftPlayers: DraftPlayer[] = [
  { id: "p1", name: "Shohei Ohtani", team: "LAA", positions: ["DH"], avg: 0.394, hr: 54, rbi: 130, sb: 26, ppaValue: 9.2, recommendedBid: 40 },
  { id: "p2", name: "Aaron Judge", team: "NYY", positions: ["RF"], avg: 0.322, hr: 98, rbi: 144, sb: 3, ppaValue: 10.6, recommendedBid: 12 },
  { id: "p3", name: "Juan Soto", team: "NYM", positions: ["LF"], avg: 0.288, hr: 41, rbi: 109, sb: 7, ppaValue: 7.1, recommendedBid: 75 },
  { id: "p4", name: "José Ramírez", team: "CLE", positions: ["3B"], avg: 0.279, hr: 39, rbi: 118, sb: 20, ppaValue: 7.5, recommendedBid: 11 },
  { id: "p5", name: "Kyle Tucker", team: "HOU", positions: ["RF"], avg: 0.289, hr: 35, rbi: 107, sb: 39, ppaValue: 6.8, recommendedBid: 17 },
  { id: "p6", name: "Bobby Witt Jr.", team: "KC", positions: ["SS"], avg: 0.302, hr: 30, rbi: 103, sb: 49, ppaValue: 7.0, recommendedBid: 24 },
  { id: "p7", name: "Gunnar Henderson", team: "BAL", positions: ["3B", "SS"], avg: 0.281, hr: 28, rbi: 84, sb: 18, ppaValue: 6.5, recommendedBid: 23 },
  { id: "p8", name: "Yordan Alvarez", team: "HOU", positions: ["DH", "LF"], avg: 0.398, hr: 35, rbi: 97, sb: 1, ppaValue: 5.2, recommendedBid: 27 },
  { id: "p9", name: "Zack Wheeler", team: "PHI", positions: ["SP"], avg: null, hr: 0, rbi: 0, sb: 0, ppaValue: 6.2, recommendedBid: 34 },
  { id: "p10", name: "Fernando Tatis Jr.", team: "SD", positions: ["RF"], avg: 0.272, hr: 31, rbi: 88, sb: 28, ppaValue: 5.3, recommendedBid: 21 },
  { id: "p11", name: "Freddie Freeman", team: "LAD", positions: ["1B"], avg: 0.282, hr: 22, rbi: 89, sb: 5, ppaValue: 5.8, recommendedBid: 34 },
  { id: "p12", name: "Julio Rodríguez", team: "SEA", positions: ["CF"], avg: 0.275, hr: 32, rbi: 92, sb: 37, ppaValue: 5.9, recommendedBid: 23 },
  { id: "p13", name: "Mookie Betts", team: "LAD", positions: ["SS", "RF"], avg: 0.289, hr: 19, rbi: 75, sb: 14, ppaValue: 6.6, recommendedBid: 11 },
  { id: "p14", name: "Matt Olson", team: "ATL", positions: ["1B"], avg: 0.254, hr: 44, rbi: 103, sb: 0, ppaValue: 5.0, recommendedBid: 30 },
  { id: "p15", name: "Elly De La Cruz", team: "CIN", positions: ["SS"], avg: 0.262, hr: 25, rbi: 76, sb: 47, ppaValue: 5.3, recommendedBid: 22 },
  { id: "p16", name: "Corey Seager", team: "TEX", positions: ["SS"], avg: 0.278, hr: 33, rbi: 96, sb: 2, ppaValue: 5.5, recommendedBid: 38 },
];

export const DEFAULT_ROOM_TEAM_COUNT = 8;
export const MAX_ROOM_TEAM_COUNT = 12;
export const MAX_ROSTER_SLOTS = 25;

export function buildMockDraftTeams(myTeamName?: string, oppTeamName?: string): DraftTeam[] {
  const names = [
    myTeamName?.trim() || "My Team",
    oppTeamName?.trim() || "Team A",
    "Team B",
    "Team C",
    "Team D",
    "Team E",
    "Team F",
    "Team G",
  ];

  return names.slice(0, DEFAULT_ROOM_TEAM_COUNT).map((name, idx) => ({
    id: `team-${idx + 1}`,
    name,
    isMine: idx === 0,
  }));
}