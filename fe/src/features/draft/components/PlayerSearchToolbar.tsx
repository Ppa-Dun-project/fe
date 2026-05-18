// Search + sort + position chips row that sits above the player list.
// Presentation only: every value and callback flows through props from DraftPage.
// Stat selection happens inline in the StatPickerStrip between ComparisonPanel and PlayerListTable.

import FadeIn from "../../../components/ui/FadeIn";
import Dropdown from "../../../components/ui/Dropdown";
import type { DraftPositionFilter, DraftSort } from "../../../types/draft";

type Props = {
  query: string;
  onChangeQuery: (next: string) => void;
  sort: DraftSort;
  sortOptions: { value: DraftSort; label: string }[];
  onChangeSort: (next: DraftSort) => void;
  positionFilters: readonly DraftPositionFilter[];
  position: DraftPositionFilter;
  onChangePosition: (next: DraftPositionFilter) => void;
  hasDraftConfig: boolean;
  remainingBudget: number;
};

export default function PlayerSearchToolbar({
  query,
  onChangeQuery,
  sort,
  sortOptions,
  onChangeSort,
  positionFilters,
  position,
  onChangePosition,
  hasDraftConfig,
  remainingBudget,
}: Props) {
  return (
    <FadeIn delayMs={100} className="relative z-40">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full lg:max-w-md">
            <div className="text-xs font-extrabold text-white/70">Search</div>
            <input
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Search player name..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
            />
          </div>

          <div className="w-full lg:w-72">
            <Dropdown<DraftSort>
              label="Sort"
              value={sort}
              options={sortOptions}
              onChange={onChangeSort}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {positionFilters.map((filterValue) => {
            const active = position === filterValue;
            return (
              <button
                key={filterValue}
                onClick={() => onChangePosition(filterValue)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-extrabold transition",
                  active
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                ].join(" ")}
              >
                {filterValue}
              </button>
            );
          })}

          {hasDraftConfig && (
            <div className="ml-auto rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
              Remaining Budget: ${remainingBudget}
            </div>
          )}
        </div>
      </section>
    </FadeIn>
  );
}
