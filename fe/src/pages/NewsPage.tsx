// Link: page navigation link (React Router's version of <a>, navigates without a full reload)
import { Link } from "react-router-dom";

import FadeIn from "../components/ui/FadeIn";
import NewsCard from "../features/home/NewsCard";
// Hard-coded news data (shared with HomePage)
import { STATIC_NEWS } from "../features/home/newsData";

/**
 * NewsPage: full news list page
 * - Entered via the "View all →" button on HomePage
 * - Reuses NewsCard for a consistent UI
 */
export default function NewsPage() {
  return (
    <div className="space-y-6">
      {/* Top header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">All News</h1>
            <p className="mt-1 text-sm text-white/60">
              Latest MLB and fantasy baseball news
            </p>
          </div>
          {/* Back-to-home link */}
          <Link
            to="/"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white/70 hover:text-white hover:bg-white/5 transition"
          >
            ← Back to Home
          </Link>
        </div>
      </FadeIn>

      {/* News list */}
      <FadeIn delayMs={60}>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="grid grid-cols-1 gap-4">
            {/* Iterate over the array and render each item */}
            {STATIC_NEWS.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </FadeIn>
    </div>
  );
}
