import type { DraftPlayer, DraftPositionFilter, DraftTeam } from "../../types/draft";

export const draftPositionFilters: DraftPositionFilter[] = [
  "ALL",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "UTIL",
  "SP",
  "RP",
];

export function buildMockDraftTeams(myTeamName: string, oppTeamName: string): DraftTeam[] {
  return [
    { id: "team-me", name: myTeamName || "My Team", isMine: true },
    { id: "team-opp", name: oppTeamName || "Opponent", isMine: false },
    { id: "team-3", name: "Blue Sox", isMine: false },
    { id: "team-4", name: "City Sluggers", isMine: false },
    { id: "team-5", name: "Night Owls", isMine: false },
    { id: "team-6", name: "Harbor Aces", isMine: false },
  ];
}

export const mockDraftPlayers: DraftPlayer[] = [
  { id: "p1", name: "Shohei Ohtani", positions: ["UTIL"], recommendedBid: 52, team: "LAD", avg: 0.304, hr: 44, rbi: 95, sb: 28, ppaValue: 99.2 },
  { id: "p2", name: "Mookie Betts", positions: ["OF"], recommendedBid: 41, team: "LAD", avg: 0.289, hr: 35, rbi: 97, sb: 17, ppaValue: 93.8 },
  { id: "p3", name: "Bobby Witt Jr.", positions: ["SS"], recommendedBid: 45, team: "KC", avg: 0.282, hr: 31, rbi: 97, sb: 49, ppaValue: 96.1 },
  { id: "p4", name: "Aaron Judge", positions: ["OF"], recommendedBid: 44, team: "NYY", avg: 0.271, hr: 50, rbi: 118, sb: 8, ppaValue: 95.0 },
  { id: "p5", name: "Freddie Freeman", positions: ["1B"], recommendedBid: 37, team: "LAD", avg: 0.308, hr: 28, rbi: 101, sb: 16, ppaValue: 90.7 },
  { id: "p6", name: "Jose Ramirez", positions: ["3B"], recommendedBid: 36, team: "CLE", avg: 0.279, hr: 31, rbi: 102, sb: 27, ppaValue: 90.1 },
  { id: "p7", name: "Francisco Lindor", positions: ["SS"], recommendedBid: 33, team: "NYM", avg: 0.271, hr: 26, rbi: 88, sb: 29, ppaValue: 86.4 },
  { id: "p8", name: "Adley Rutschman", positions: ["C"], recommendedBid: 18, team: "BAL", avg: 0.268, hr: 21, rbi: 79, sb: 2, ppaValue: 72.2 },
  { id: "p9", name: "Marcus Semien", positions: ["2B"], recommendedBid: 24, team: "TEX", avg: 0.274, hr: 24, rbi: 90, sb: 14, ppaValue: 79.5 },
  { id: "p10", name: "Corey Seager", positions: ["SS"], recommendedBid: 31, team: "TEX", avg: 0.301, hr: 33, rbi: 97, sb: 2, ppaValue: 84.3 },
  { id: "p11", name: "Juan Soto", positions: ["OF"], recommendedBid: 39, team: "NYY", avg: 0.288, hr: 37, rbi: 104, sb: 9, ppaValue: 91.7 },
  { id: "p12", name: "Corbin Burnes", positions: ["SP"], recommendedBid: 28, team: "BAL", avg: 0.0, hr: 0, rbi: 0, sb: 0, ppaValue: 83.1 },
  { id: "p13", name: "Zack Wheeler", positions: ["SP"], recommendedBid: 26, team: "PHI", avg: 0.0, hr: 0, rbi: 0, sb: 0, ppaValue: 81.9 },
  { id: "p14", name: "Edwin Diaz", positions: ["RP"], recommendedBid: 16, team: "NYM", avg: 0.0, hr: 0, rbi: 0, sb: 0, ppaValue: 70.0 },
  { id: "p15", name: "Josh Hader", positions: ["RP"], recommendedBid: 15, team: "HOU", avg: 0.0, hr: 0, rbi: 0, sb: 0, ppaValue: 68.9 },
];
