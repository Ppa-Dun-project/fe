// "Compare" toolbar — two emerald slots (A / B) plus Clear / Compare buttons.
// Each slot shows the selected player's name, position, team, recommended bid,
// and a one-line stat summary. Presentation only.

import FadeIn from "../../../components/ui/FadeIn";
import type { DraftPlayer } from "../../../types/draft";
import { formatDraftStatSummary } from "../draftHelpers";

type Props = {
  selectedA: DraftPlayer | null;
  selectedB: DraftPlayer | null;
  authed: boolean;
  onClearA: () => void;
  onClearB: () => void;
  onClearAll: () => void;
  onOpenComparison: () => void;
};

type SlotProps = {
  label: "A" | "B";
  player: DraftPlayer | null;
  onClear: () => void;
};

function CompareSlot({ label, player, onClear }: SlotProps) {
  return (
    <div className="min-w-0 w-full rounded-xl border border-emerald-400/50 bg-emerald-500/12 px-3 py-2 shadow-[0_0_16px_rgba(16,185,129,0.18)] sm:w-[300px]">
      {player ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-white/80">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 font-black text-emerald-100">
                {label}
              </span>
              <span className="truncate font-black text-white">{player.name}</span>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-black/20 text-[10px] font-black text-white/80 transition hover:bg-white/15"
              aria-label={`Remove player ${label} from compare`}
              title={`Remove player ${label}`}
            >
              X
            </button>
          </div>
          <div className="mt-1 text-[11px] font-semibold text-white/70">
            {player.positions.join("/")} - {player.team} - ${player.recommendedBid ?? "—"}
          </div>
          <div className="mt-1 text-[10px] text-white/55">
            {formatDraftStatSummary(player)}
          </div>
        </>
      ) : (
        <div className="text-xs font-bold text-white/55">Select player {label}</div>
      )}
    </div>
  );
}

export default function ComparisonPanel({
  selectedA,
  selectedB,
  authed,
  onClearA,
  onClearB,
  onClearAll,
  onOpenComparison,
}: Props) {
  const bothSelected = Boolean(selectedA && selectedB);
  const noneSelected = !selectedA && !selectedB;

  return (
    <FadeIn delayMs={120}>
      <section className="rounded-2xl border border-fuchsia-500/55 bg-[#1b1228] p-4 shadow-[0_0_22px_rgba(168,85,247,0.22)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="rounded-xl bg-fuchsia-500/15 px-4 py-3 ring-1 ring-fuchsia-300/40 lg:min-w-[170px]">
              <div className="text-sm font-black text-fuchsia-200">Compare</div>
              <div className="mt-0.5 text-[11px] font-bold text-white/65">Select 2 players</div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
              <CompareSlot label="A" player={selectedA} onClear={onClearA} />
              <div className="text-center text-xs font-black text-fuchsia-200 sm:px-1">VS</div>
              <CompareSlot label="B" player={selectedB} onClear={onClearB} />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              type="button"
              onClick={onClearAll}
              disabled={noneSelected}
              className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-xs font-black text-white/80 transition hover:bg-white/10 disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onOpenComparison}
              disabled={!bothSelected || !authed}
              className="rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-black text-white transition hover:bg-fuchsia-500 disabled:opacity-40"
              title={!authed ? "Sign in required" : "Open player comparison"}
            >
              Compare
            </button>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
