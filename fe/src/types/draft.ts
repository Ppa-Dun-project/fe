/**
 * DraftPlayerPublic: basic player info returned by the public /api/draft/players endpoint.
 * - PPA-DUN value and recommended draft bid are NOT included here (served separately from the authenticated endpoint).
 */
export type DraftPlayerPublic = {
  id: string;
  name: string;
  playerType: "batter" | "pitcher" | "two_way";
  team: string;                  // MLB team abbreviation (e.g. "NYY")
  positions: string[];           // Array of positions (e.g. ["OF", "DH"])

  // ── Batter stats ────────────────────────────────────────────────────────
  ab: number | null;             // At-bats
  r: number | null;              // Runs scored (batter) / runs allowed (pitcher)
  h: number | null;              // Hits (batter) / hits allowed (pitcher)
  single: number | null;         // Singles
  double: number | null;         // Doubles
  triple: number | null;         // Triples
  hr: number | null;             // Home runs (batter) / home runs allowed (pitcher)
  rbi: number | null;            // Runs batted in
  bb: number | null;             // Walks (batter) / walks allowed (pitcher)
  k: number | null;              // Strikeouts
  sb: number | null;             // Stolen bases
  cs: number | null;             // Caught stealing
  avg: number | null;            // Batting average
  obp: number | null;            // On-base percentage
  slg: number | null;            // Slugging percentage

  // ── Pitcher stats (h, r, hr, bb are shared with above — meaning depends on context) ──
  w: number | null;              // Wins
  l: number | null;              // Losses
  sv: number | null;             // Saves
  so: number | null;             // Strikeouts (pitcher)
  era: number | null;            // Earned run average
  whip: number | null;           // WHIP
  ip: number | null;             // Innings pitched (decimal is in 1/3 notation — 184.2 = 184 2/3)
  g: number | null;              // Games appeared
  gs: number | null;             // Games started
  war: number | null;            // WAR
  fip: number | null;            // FIP
  er: number | null;             // Earned runs
  hbp: number | null;            // Hit by pitch
  bf: number | null;             // Batters faced
  era_plus: number | null;       // Adjusted ERA (ERA+)
  h9: number | null;             // Hits allowed per 9 innings
  hr9: number | null;             // Home runs allowed per 9 innings
  bb9: number | null;             // Walks per 9 innings
  so9: number | null;             // Strikeouts per 9 innings
  so_bb: number | null;           // K/BB ratio
};

/**
 * DraftPlayerValue: value info returned by the authenticated GET /api/draft/players/value endpoint.
 * - Merged with DraftPlayerPublic using playerId as the key to build a DraftPlayer.
 * - recommendedBid is fetched individually from the modal (DraftPlayerBid).
 */
export type DraftPlayerValue = {
  playerId: string;
  ppaValue: number | null;       // PPA-DUN value score
};

/**
 * DraftPlayerBid: single-item response from POST /api/draft/players/bid.
 * - Called on demand while the modal is open after clicking the Add button.
 */
export type DraftPlayerBid = {
  playerId: string;
  recommendedBid: number | null;
};

/**
 * DraftPlayer: the merged player type used by the UI.
 * - ppaValue is populated by the batch fetch. recommendedBid is NOT populated in the merge flow (passed via modal props).
 *   The type keeps it optional for compatibility, but mergePlayersWithValues no longer sets it.
 */
export type DraftPlayer = DraftPlayerPublic & {
  ppaValue?: number | null;
  recommendedBid?: number | null;
};

/**
 * DraftTeam: a team participating in the draft room.
 */
export type DraftTeam = {
  id: string;
  name: string;
  isMine?: boolean;              // Whether this is my team (optional)
};

/**
 * DraftPickType: the kind of draft pick.
 * - Union type: must be exactly one of the two values.
 */
export type DraftPickType = "mine" | "taken";

/**
 * DraftPickKind: identifies which board a pick belongs to.
 * - main: the regular draft (position slot + bid).
 * - minor / taxi: free picks made before or after the main draft. No position or bid.
 */
export type DraftPickKind = "main" | "minor" | "taxi";

/**
 * ContractCode: keeper / contract status. The original value the user picked at signing time.
 * When displayed on screen, computed dynamically by subtracting (targetSeason − signedSeason).
 *   F3/F2/F1 = Free Agent (3/2/1 years remaining)
 *   S1       = Single-year contract
 *   L2/LX    = Long-term contract (2 years remaining / expired)
 *   X        = Expired / unprotected
 */
export type ContractCode = "F3" | "F2" | "F1" | "S1" | "L2" | "LX" | "X";

/**
 * DraftPick: information for a single draft pick.
 */
export type DraftPick = {
  playerId: string;              // ID of the drafted player
  draftedByTeamId: string;       // ID of the team that drafted the player
  slotIndex: number;             // Roster slot index
  slotPos: string | null;        // Slot position — null for minor/taxi
  bid: number | null;            // Winning bid ($) — null for minor/taxi
  type: DraftPickType;           // "mine" or "taken"
  kind: DraftPickKind;           // "main" | "minor" | "taxi"
  contractCode?: ContractCode | null;  // Keeper contract code at signing time (null for legacy picks)
  signedSeason?: number | null;        // targetSeason of the session when the player was signed (null for legacy picks)
};

/**
 * DraftConfigLocal: draft configuration (persisted in localStorage).
 * - User fills this in on HomePage → consumed when entering the draft room.
 */
export type DraftConfigLocal = {
  myTeamName?: string;
  oppTeamNames?: string[];       // Names of the opponent teams
  opponentsCount?: number;       // Number of opponents
  leagueType?: string;           // "AL" | "NL" | "custom" (legacy sessions may have "standard"|"lite" — handled via fallback)
  budget?: number;               // Budget ($)
  rosterPlayers?: number;        // Roster size
  rosterSlots?: RosterSlotCounts; // Slot count per position
  targetSeason?: number;         // Reference season for keeper rollover (e.g. 2027)
  createdAt?: string;            // Config creation timestamp
};

/**
 * DraftConfigServer: the config shape contained in the backend session response.
 * - Unlike DraftConfigLocal, every field is required (the server normalizes the values).
 * - rosterSlots is optional because legacy sessions may not have it.
 */
export type DraftConfigServer = {
  leagueType: string;
  budget: number;
  rosterPlayers: number;
  myTeamName: string;
  opponentsCount: number;
  oppTeamNames: string[];
  rosterSlots?: RosterSlotCounts;
  targetSeason?: number | null;  // Legacy sessions may be null/undefined
};

/**
 * RosterSlotCounts: the per-position slot counts chosen by the user in the Draft Setup modal.
 * Start Draft is only enabled once the sum equals rosterPlayers.
 */
export type RosterSlotPosition =
  | "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "UTIL" | "SP" | "RP" | "BENCH";
export type RosterSlotCounts = Record<RosterSlotPosition, number>;

/**
 * SessionSummary: each item from GET /api/draft/sessions (used by the Import modal).
 */
export interface SessionSummary {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

/**
 * SessionDetail: full data for a single session (GET/POST/PUT response).
 */
export interface SessionDetail {
  id: number;
  name: string;
  config: DraftConfigServer;
  teams: DraftTeam[];
  picks: DraftPick[];
}

/**
 * PlayerNote: a player note. Unique per (session_id, player_id) pair within a session.
 * - An item in the GET /api/draft/sessions/{id}/notes response.
 */
export type PlayerNote = {
  playerId: string;
  note: string;
  updatedAt: string;
};

/**
 * DraftSort: sort options for the draft page.
 * - _desc: descending (highest first).
 * - _asc: ascending.
 */
// Sort options for the player list.
//   - "score_desc" / "score_asc" — sort by PPA-DUN value (the always-available default).
//   - `stat:${key}` — sort by one of the currently selected stat columns (dynamic).
//     The stat key matches a StatDef.key; lowerIsBetter (ERA / WHIP / …) is honored.
export type DraftSort = "score_desc" | "score_asc" | `stat:${string}`;

/**
 * DraftPositionFilter: position filter options.
 * - "ALL" is intentionally excluded — batter and pitcher stats are separate, and mixing them
 *   on one screen would leave empty columns (in preparation for the "pick 5 stat columns" feature).
 * - "P" is intentionally excluded — pitchers can only be filtered as SP / RP.
 */
export type DraftPositionFilter =
  | "SP"       // Starting pitcher
  | "RP"       // Relief pitcher
  | "C"        // Catcher
  | "1B"       // First base
  | "2B"       // Second base
  | "3B"       // Third base
  | "SS"       // Shortstop
  | "OF"       // Outfield
  | "UTIL";    // Utility
