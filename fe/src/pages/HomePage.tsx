import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import FadeIn from "../components/ui/FadeIn";
import Modal from "../components/ui/Modal";
import Skeleton from "../components/ui/Skeleton";

import type { NewsItem } from "../types/home";
import NewsCard from "../features/home/NewsCard";
import { apiGet } from "../lib/api";

import DraftSetupCard from "../features/home/DraftSetupCard";
import SignInCard from "../features/home/SignInCard";

import baseballImg from "../assets/Baseball.jpg";
import { useAuth } from "../lib/auth";

type NewsListResponse = {
  items: NewsItem[];
  total: number;
};

export default function HomePage() {
  const navigate = useNavigate();
  const authed = useAuth(); // ✅ reactive auth (updates immediately on login/logout)

  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const onSearch = () => {
    const q = query.trim();
    if (!q) return;
    // ✅ Draft is the new list page
    navigate(`/draft?query=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setNewsLoading(true);
      setNewsError(null);
    });

    apiGet<NewsListResponse>("/api/news", { limit: 3 }, controller.signal)
      .then((data) => setNews(data.items))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setNews([]);
        setNewsError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setNewsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <FadeIn>
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black p-6 md:p-10">
          <div className="absolute inset-0">
            <img
              src={baseballImg}
              alt="Baseball background"
              className="h-full w-full object-cover object-right origin-right scale-80 brightness-145 saturate-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]" />
          </div>

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70">
                PPA-Dun Project • TEAM BLACK
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                Build your roster with the Best Players.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Check the latest news, scout top players for your Fantasy.
              </p>
            </div>

            {/* Search */}
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur">
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

      {/* Grid: News + Right panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Latest News */}
        <FadeIn className="lg:col-span-2" delayMs={60}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Latest News</h2>
                <p className="mt-1 text-sm text-white/60">
                  Guest users can read news anytime.
                </p>
              </div>

              <button
                className="text-xs font-bold text-white/60 hover:text-white transition"
                onClick={() => {
                  // TODO: If you add a dedicated news page later, navigate("/news")
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

              {!newsLoading &&
                !newsError &&
                news.map((item) => (
                  <NewsCard key={item.id} item={item} onClick={() => setSelected(item)} />
                ))}
            </div>
          </section>
        </FadeIn>

        {/* Right panel: guest => SignInCard, authed => DraftSetupCard */}
        <FadeIn className="lg:col-span-1" delayMs={120}>
          {authed ? <DraftSetupCard /> : <SignInCard />}
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
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/5 transition"
              >
                Open link
              </a>
            )}
            <button
              onClick={() => setSelected(null)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90 transition"
            >
              Close
            </button>
          </>
        }
      >
        <p className="text-sm leading-6">{selected?.summary}</p>
        <div className="mt-4 text-xs text-white/50">
          Published: {selected ? new Date(selected.publishedAt).toLocaleString() : ""}
        </div>
      </Modal>
    </div>
  );
}
