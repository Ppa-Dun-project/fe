import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FadeIn from "../components/ui/FadeIn";
import Modal from "../components/ui/Modal";
import Skeleton from "../components/ui/Skeleton";
import type { NewsItem } from "../types/home";
import NewsCard from "../features/home/NewsCard";
import TopPlayerCard from "../features/home/TopPlayerCard";
import { mockNews, mockTopPlayers } from "../features/home/mock";

export default function HomePage() {
  const navigate = useNavigate();

  // MVP: 실제 API 붙기 전까지 UI를 위해 mock + loading 시뮬레이션
  const [newsLoading] = useState(false);
  const [newsError] = useState<string | null>(null);
  const news = useMemo(() => mockNews, []);

  const [topLoading] = useState(false);
  const topPlayers = useMemo(() => mockTopPlayers.slice(0, 4), []);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const onSearch = () => {
    const q = query.trim();
    if (!q) return;
    navigate(`/players?query=${encodeURIComponent(q)}`);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <FadeIn>
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                BLACK THEME • PPA-Dun
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Build your roster with explainable ValueScores.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Check the latest news, scout top players, and jump straight into search.
                Keep it clean. Keep it Black.
              </p>
            </div>

            {/* Search */}
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch();
                  }}
                  placeholder="Search players (e.g., Judge, Ohtani)..."
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
                />
                <button
                  onClick={onSearch}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:translate-y-[-1px] hover:bg-white/90 active:translate-y-0"
                >
                  Search
                </button>
              </div>
              <div className="mt-2 text-xs text-white/50">
                Tip: Press Enter to search.
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Grid: News + Top Players */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Latest News */}
        <FadeIn className="md:col-span-2" delayMs={60}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Latest News</h2>
                <p className="mt-1 text-sm text-white/60">
                  Guest users can read news anytime.
                </p>
              </div>
              <button
                className="text-xs text-white/60 hover:text-white transition"
                onClick={() => {
                  // 나중에 실제 뉴스 페이지가 생기면 이동
                  // navigate("/news");
                }}
              >
                View all →
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              {newsLoading && (
                <>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </>
              )}

              {!newsLoading && newsError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  Failed to load news: {newsError}
                </div>
              )}

              {!newsLoading && !newsError && news.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  No news yet.
                </div>
              )}

              {!newsLoading && !newsError && news.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Top Players (optional but included) */}
        <FadeIn className="md:col-span-1" delayMs={120}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Top Players</h2>
            <p className="mt-1 text-sm text-white/60">
              Highest ValueScore right now.
            </p>

            <div className="mt-5 space-y-3">
              {topLoading ? (
                <>
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </>
              ) : (
                topPlayers.map((p) => (
                  <TopPlayerCard
                    key={p.id}
                    player={p}
                    onClick={() => navigate(`/players/${p.id}`)}
                  />
                ))
              )}
            </div>
          </section>
        </FadeIn>
      </div>

      {/* News modal */}
      <Modal
        open={Boolean(selected)}
        title={selected?.title}
        onClose={() => setSelected(null)}
        footer={
          <>
            {selected?.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/90 hover:bg-white/5 transition"
              >
                Open link
              </a>
            )}
            <button
              onClick={() => setSelected(null)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
            >
              Close
            </button>
          </>
        }
      >
        <p className="text-sm leading-6">
          {selected?.summary}
        </p>
        <div className="mt-4 text-xs text-white/50">
          Published: {selected ? new Date(selected.publishedAt).toLocaleString() : ""}
        </div>
      </Modal>
    </div>
  );
}