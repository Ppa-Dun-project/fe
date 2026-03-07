export type DraftPlayer = {
  id: string;
  name: string;
  team: string; // MLB team
  positions: string[]; // ex) ["DH"], ["LF"], ["SP"]
  avg: number | null;
  hr: number | null;
  rbi: number | null;
  sb: number | null;
  ppaValue: number;
  recommendedBid: number; // 추천/예상 드래프트 비용
};

export type DraftTeam = {
  id: string;
  name: string;
  isMine?: boolean;
};

export type DraftPickType = "mine" | "taken";

export type DraftPick = {
  playerId: string;
  draftedByTeamId: string;
  slotIndex: number;
  slotPos: string;
  bid: number | null;
  type: DraftPickType;
};

export type DraftConfigLocal = {
  myTeamName?: string;
  oppTeamName?: string;
  leagueType?: string;
  budget?: number;
  rosterPlayers?: number;
  createdAt?: string;
};

export type DraftSort =
  | "score_desc"
  | "score_asc"
  | "cost_desc"
  | "cost_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";

export type DraftPositionFilter =
  | "ALL"
  | "SP"
  | "RP"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF"
  | "DH";