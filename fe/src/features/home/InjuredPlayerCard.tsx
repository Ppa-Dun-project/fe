import type { InjuredPlayer } from "../../types/home";

/**
 * InjuredPlayerCard: a single injured-player card
 * - Reused in both the HomePage strip (3 cards) and the View All popup
 * - Color-coded by status (Day-To-Day → yellow, IL → orange, Out/60-Day → red)
 */

// status → tailwind class mapping. Any unmatched status falls back to the default tone.
const STATUS_TONE: Record<string, string> = {
  "Day-To-Day": "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
  "7-Day IL":   "text-orange-300 bg-orange-500/10 border-orange-500/20",
  "10-Day IL":  "text-orange-300 bg-orange-500/10 border-orange-500/20",
  "15-Day IL":  "text-orange-300 bg-orange-500/10 border-orange-500/20",
  "60-Day IL":  "text-red-300 bg-red-500/10 border-red-500/20",
  "Out":        "text-red-300 bg-red-500/10 border-red-500/20",
};
const FALLBACK_TONE = "text-white/60 bg-white/5 border-white/10";

// MLB CDN headshot — assembled automatically from player_id.
// The same pattern is used in PlayerInfoModal (for consistency across the service).
const headshotUrl = (id: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${id}/headshot/67/current`;

type Props = { item: InjuredPlayer };

export default function InjuredPlayerCard({ item }: Props) {
  const tone = STATUS_TONE[item.injury_status] ?? FALLBACK_TONE;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/8 hover:-translate-y-[2px]">
      <div className="flex items-center gap-3">
        {/* MLB headshot — onError hides broken images (keeping only the placeholder space). */}
        <img
          src={headshotUrl(item.player_id)}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-full bg-white/5 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
        />

        <div className="min-w-0 flex-1">
          {/* Name + jersey number */}
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{item.name}</h3>
            {item.primary_number && (
              <span className="text-xs text-white/40">#{item.primary_number}</span>
            )}
          </div>

          {/* Position · team */}
          <p className="mt-0.5 text-xs text-white/50">
            {item.position ?? "—"} · {item.team ?? "—"}
          </p>

          {/* Status badge */}
          <span
            className={`mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}
          >
            {item.injury_status}
          </span>
        </div>
      </div>
    </div>
  );
}
