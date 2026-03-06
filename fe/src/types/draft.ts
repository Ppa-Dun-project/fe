export type DraftPosition =
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "OF"
  | "UTIL"
  | "SP"
  | "RP"
  | "BENCH";

export type DraftPositionFilter = "ALL" | Exclude<DraftPosition, "BENCH">;

export type DraftSort =
  | "score_desc"
  | "score_asc"
  | "cost_desc"
  | "cost_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";

export type DraftPlayer = {
  id: string;
  name: string;
  positions: DraftPosition[];
  recommendedBid: number;
  team: string;
  avg?: number;
  hr?: number;
  rbi?: number;
  sb?: number;
  ppaValue: number;
};

export type DraftTeam = {
  id: string;
  name: string;
  isMine: boolean;
};

export type DraftPick = {
  playerId: string;
  draftedByTeamId: string;
  slotIndex: number;
  slotPos: DraftPosition;
  bid: number | null;
  type: "mine" | "taken";
};

export type DraftConfig = {
  leagueType: string;
  budget: number;
  rosterPlayers: number;
  myTeamName: string;
  oppTeamName: string;
};
