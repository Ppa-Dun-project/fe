import type { NewsItem, TopPlayer } from "../../types/home";

export const mockNews: NewsItem[] = [
  {
    id: "n1",
    title: "Black Board: Weekly Fantasy Recap",
    summary: "Top risers, biggest fallers, and one sneaky pickup you should not miss.",
    publishedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    url: "https://example.com/news/1",
    source: "PPA-Dun",
  },
  {
    id: "n2",
    title: "Pitching Streamers to Watch",
    summary: "3 streamers with solid matchups this week — low risk, high upside.",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    url: "https://example.com/news/2",
    source: "PPA-Dun",
  },
  {
    id: "n3",
    title: "Injury Report: What to Do Now",
    summary: "Quick actions to protect your roster and keep your ValueScore climbing.",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    url: "https://example.com/news/3",
    source: "PPA-Dun",
  },
];

export const mockTopPlayers: TopPlayer[] = [
  { id: "p1", name: "Aaron Judge", team: "NYY", positions: ["OF"], valueScore: 98.2 },
  { id: "p2", name: "Mookie Betts", team: "LAD", positions: ["2B", "OF"], valueScore: 95.4 },
  { id: "p3", name: "Shohei Ohtani", team: "LAD", positions: ["DH"], valueScore: 94.7 },
  { id: "p4", name: "Gerrit Cole", team: "NYY", positions: ["P"], valueScore: 92.1 },
];