/**
 * NewsItem: shape of a news article entry.
 * - Fields marked with ? are optional.
 */
export type NewsItem = {
  id: string;              // Unique identifier
  title: string;           // News title
  summary: string;         // News summary
  publishedAt: string;     // Published time (ISO string)
  url?: string;            // Link to the original article (optional)
  source?: string;         // Source (optional, e.g. "MLB.com")
  imageUrl?: string;       // Thumbnail image URL (optional; falls back to text-only display)
};

/**
 * InjuredPlayer: used by the HomePage Injured Players strip + popup.
 * Maps 1:1 to the backend GET /api/players/injured response shape.
 */
export type InjuredPlayer = {
  player_id: number;       // MLB stable ID — used in the headshot URL
  name: string;
  position?: string;       // OF / 3B / SP ...
  team?: string;           // NYY / LAA ...
  primary_number?: string; // jersey number (#)
  injury_status: string;   // Day-To-Day / 10-Day IL / Out ...
  player_value?: number;   // 0–100 fantasy value (used only for sorting)
};

/**
 * TopPlayer: top-player info (currently unused, but the type definition is kept).
 */
export type TopPlayer = {
  id: string;
  name: string;
  team: string;            // MLB team abbreviation
  positions: string[];     // List of positions (array)
  valueScore: number;      // PPA-DUN value score
};
