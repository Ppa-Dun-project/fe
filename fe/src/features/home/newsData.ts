import type { NewsItem } from "../../types/home";

/**
 * hoursAgo: helper that produces an ISO timestamp from N hours ago
 * - Date.now(): current millisecond timestamp
 * - h * 60 * 60 * 1000: converts N hours into milliseconds
 * - .toISOString(): ISO 8601 formatted string (e.g., "2026-04-17T10:00:00.000Z")
 */
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

/**
 * STATIC_NEWS: hardcoded news data
 * - Static data so the frontend can render directly without a backend
 * - Shared by HomePage (shows 3) and NewsPage (shows all)
 */
export const STATIC_NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "6 MVP Awards, 4 HRs: Trout, Judge do battle in epic dinger duel",
    summary:
      "Mike Trout and Aaron Judge each hit two homers as the Yankees edged the Angels in a memorable slugfest between two generational talents.",
    publishedAt: hoursAgo(2),   // 2 hours ago
    url: "https://www.mlb.com/news/mike-trout-aaron-judge-each-hit-two-homers-in-yankees-win-over-angels",
    source: "MLB.com",
  },
  {
    id: "n2",
    title: "Top 100 MLB Players for the 2026 Season",
    summary:
      "A comprehensive ranking of the best 100 players heading into the 2026 MLB season, from rising stars to established superstars.",
    publishedAt: hoursAgo(8),   // 8 hours ago
    url: "https://www.justbaseball.com/mlb/top-100-mlb-players-ranking-2026/",
    source: "Just Baseball",
  },
  {
    id: "n3",
    title: "MLB's average player salary rises to $5.34M",
    summary:
      "MLB's average player salary rises to $5.34M, plus which team is barely spending more than a top player makes.",
    publishedAt: hoursAgo(18),  // 18 hours ago
    url: "https://www.cbssports.com/mlb/news/mlb-average-player-salary-juan-soto-cody-bellinger-mets-guardians/",
    source: "CBS Sports",
  },
];
