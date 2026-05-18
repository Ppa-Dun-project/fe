/**
 * MyTeamPlayer: a player drafted onto my team.
 * - Similar to DraftPlayer but with slightly different fields (includes cost).
 */
export type MyTeamPlayer = {
  id: string;
  name: string;
  playerType: "batter" | "pitcher";
  pos: string;            // Position (single)
  cost: number;           // Winning bid ($)
  team: string;           // MLB team
  avg: number;            // Batting average
  hr: number;             // Home runs
  rbi: number;            // Runs batted in
  sb: number;             // Stolen bases
  w?: number | null;
  sv?: number | null;
  so?: number | null;
  era?: number | null;
  whip?: number | null;
  ip?: number | null;
  ppaValue: number;       // PPA-DUN score
};

/**
 * MyTeamPosFilter: position filter for the My Team page.
 * - More granular than DraftPositionFilter (includes LF, RF, CF, DH).
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
  | "LF"       // Left field
  | "RF"       // Right field
  | "CF"       // Center field
  | "DH"       // Designated hitter
  | "SP"
  | "RP";

/**
 * MyTeamSort: sort options for the My Team page.
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
