// useState: hook for managing component-local state
import { useEffect, useState } from "react";
// useNavigate: hook for programmatic page navigation
import { useNavigate } from "react-router-dom";

// Shared UI components
import FadeIn from "../components/ui/FadeIn";          // Fade-in animation wrapper
import NewsCard from "../features/home/NewsCard";      // News card component
import InjuredPlayersStrip from "../features/home/InjuredPlayersStrip"; // Injured-players strip + popup
import type { NewsItem } from "../types/home";

const MLB_RSS_URL = "https://sports.yahoo.com/mlb/rss/";
const RSS_TO_JSON_API = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(MLB_RSS_URL)}`;

type Rss2JsonItem = {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  thumbnail?: string;
  content?: string;        // HTML body — used to extract the thumbnail URL from the first <img> tag
};

// Extract the src attribute of the first <img> tag from the rss2json content HTML.
// The Yahoo Sports feed leaves the thumbnail field empty but embeds images inside content.
// Roughly 70% of items have an image; items without one return undefined → the card renders text-only.
const IMG_SRC_RE = /<img[^>]+src="([^"]+)"/i;
const extractImageUrl = (html: string | undefined): string | undefined =>
  html ? html.match(IMG_SRC_RE)?.[1] : undefined;

// Background image for the hero banner
import baseballImg from "../assets/Baseball.jpg";

/**
 * HomePage: landing page
 * - Top: hero banner + search box
 * - Left: three latest news cards
 * - Right: injured-player list
 */
export default function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");      // Hero search box input value
  const [news, setNews] = useState<NewsItem[]>([]);

  // Fetch the MLB RSS feed via the rss2json proxy and show only the latest 4 items
  // Polls every hour so newly published news shows up even while the page stays open
  useEffect(() => {
    const fetchNews = () => {
      fetch(RSS_TO_JSON_API)
        .then((r) => r.json())
        .then((data: { items?: Rss2JsonItem[] }) => {
          const items = (data.items ?? []).slice(0, 3).map<NewsItem>((it) => ({
            id: it.guid,
            title: it.title,
            // The RSS description contains HTML — strip the tags and use the clean text only
            summary: (it.description ?? "").replace(/<[^>]+>/g, "").trim(),
            publishedAt: it.pubDate,
            url: it.link,
            source: "Yahoo Sports",
            imageUrl: extractImageUrl(it.content),
          }));
          setNews(items);
        })
        .catch(() => setNews([]));
    };

    fetchNews();
    const interval = setInterval(fetchNews, 10 * 60 * 1000); // every 10 minutes
    return () => clearInterval(interval);
  }, []);

  // Run search — navigate to the draft page (passing the query as a URL parameter)
  const onSearch = () => {
    const q = query.trim();
    if (!q) return;  // ignore if empty
    // encodeURIComponent: encodes special characters so they're safe to embed in a URL
    navigate(`/draft?query=${encodeURIComponent(q)}`);
  };

  return (
    // space-y-8: 2rem vertical spacing between children
    <div className="space-y-8">
      <FadeIn>
        {/* Hero banner */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black p-6 md:p-10">
          {/* Background image layer */}
          <div className="absolute inset-0">
            <img
              src={baseballImg}
              alt="Baseball background"
              className="h-full w-full object-cover object-right origin-right scale-80 brightness-145 saturate-110"
            />
            {/* Gradient overlay (black on the left → transparent on the right) */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
            {/* Inner shadow effect */}
            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]" />
          </div>

          {/* Foreground content (text + search box) */}
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              {/* Small tag */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70">
                PPA-Dun Project • TEAM BLACK
              </div>
              {/* Main heading */}
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                Build your roster with the Best Players.
              </h1>
              {/* Subheading */}
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Check the latest news, scout top players for your Fantasy.
              </p>
            </div>

            {/* Search box */}
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur">
                <input
                  value={query}
                  // onChange: updates state on every keystroke (controlled input)
                  onChange={(e) => setQuery(e.target.value)}
                  // onKeyDown: runs the search when Enter is pressed
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  placeholder="Search players (e.g., Judge, Ohtani)..."
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
                />
                <button
                  onClick={onSearch}
                  className="rounded-xl bg-black/80 px-4 py-2 text-sm font-extrabold text-white
                             ring-1 ring-white/25
                             transition hover:translate-y-[-1px] hover:bg-black/70 hover:ring-white/40
                             active:translate-y-0"
                >
                  Search
                </button>
              </div>
              <div className="mt-2 text-xs text-white/60">Tip: Press Enter to search.</div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Two-column grid for news + injured players */}
      {/* grid-cols-1: 1 column by default / lg:grid-cols-3: 3 columns on large screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left news section (spans 2 of the 3 columns) */}
        <FadeIn className="lg:col-span-2" delayMs={60}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Latest News</h2>
                <p className="mt-1 text-xs text-white/50">
                  Fetched from Yahoo Sports · refreshes every 10 minutes
                </p>
              </div>
              {/* "View all" button → external link to the Yahoo Sports MLB news page */}
              <a
                href="https://sports.yahoo.com/mlb/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-white/60 hover:text-white transition"
              >
                View all →
              </a>
            </div>

            {/* Render 3 news cards (iterating with array.map) */}
            <div className="mt-5 space-y-4">
              {news.map((item) => (
                // key: unique value React uses to identify list items (required)
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Right-side injured-player section (1 of 3 columns) — natural height + internal scroll */}
        <FadeIn className="lg:col-span-1" delayMs={120}>
          <InjuredPlayersStrip />
        </FadeIn>
      </div>
    </div>
  );
}
