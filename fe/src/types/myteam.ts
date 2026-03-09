export type MyTeamPlayer = {
  id: string;
  name: string;
  pos: string;      // DH, RF, SS, SP...
  cost: number;     // $ (winning bid)
  team: string;     // MLB team
  avg: number;      // batting avg
  hr: number;
  rbi: number;
  sb: number;
  ppaValue: number; // PPA-DUN Value (valueScore)
};

export type MyTeamPosFilter =
  | "ALL"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "OF"
  | "UTIL"
  | "LF"
  | "RF"
  | "CF"
  | "DH"
  | "SP"
  | "RP";

export type MyTeamSort =
  | "score_desc"
  | "score_asc"
  | "cost_desc"
  | "cost_asc"
  | "avg_desc"
  | "hr_desc"
  | "rbi_desc"
  | "sb_desc";
