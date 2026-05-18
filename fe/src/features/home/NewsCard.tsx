// Import the NewsItem type (defines the shape of news data).
import type { NewsItem } from "../../types/home";

// Props type — the shape of the props this component receives.
type Props = {
  item: NewsItem;  // News data object
};

/**
 * NewsCard: a single news card
 * - Clicking opens the external news site in a new tab
 * - Used on both HomePage and NewsPage
 */
export default function NewsCard({ item }: Props) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:bg-white/8 hover:-translate-y-[2px] active:translate-y-0"
    >
      {/* Horizontal layout: thumbnail on the left, text on the right. */}
      {/* If imageUrl is missing or broken, a gray placeholder is shown so the card width stays consistent. */}
      <div className="flex items-stretch gap-4">
        <div className="relative hidden w-40 shrink-0 overflow-hidden bg-white/10 sm:block">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
              onError={(e) => {
                // Broken image → fall back to the placeholder (keep the area itself).
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-10 w-10 text-white/25"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="11" r="1.5" />
                <path d="M21 17l-5-5-6 6" />
              </svg>
            </div>
          )}
        </div>

        {/* Text area */}
        <div className="relative flex-1 p-5">
          {/* "Open →" indicator — absolutely positioned in the top-right corner so the title can sit flush against the top of the card. */}
          <div className="absolute right-5 top-5 text-xs text-white/40 group-hover:text-white/60 transition">
            Open →
          </div>

          {/* News title — pr-12 padding ensures it doesn't overlap with the Open label on the right. */}
          <h3 className="pr-12 text-base font-semibold text-white">{item.title}</h3>
          {/* News summary (line-clamp-2: shows at most 2 lines, truncating with "..." if it overflows). */}
          <p className="mt-2 line-clamp-2 text-sm text-white/70">{item.summary}</p>
        </div>
      </div>
    </a>
  );
}
