import { useMemo, useState } from "react";
import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";
import Dropdown from "../components/ui/Dropdown";

import { mockMyTeamPlayers, myTeamPositions, type MyTeamPosFilter } from "../features/myteam/mock";
import type { MyTeamPlayer } from "../types/myteam";
import {
  computeRemainingBudget,
  filterMyTeam,
  formatAvg,
  sortMyTeam,
  type MyTeamSort,
  teamBadgeClass,
  valueScoreClass,
} from "../features/myteam/utils";

const SORT_OPTIONS: { value: MyTeamSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "score_asc", label: "By Score" },
  { value: "cost_desc", label: "By Value $" },
  { value: "cost_asc", label: "By Value $" },
  { value: "avg_desc", label: "By AVG" },
  { value: "hr_desc", label: "By HR" },
  { value: "rbi_desc", label: "By RBI" },
  { value: "sb_desc", label: "By SB" },
];

export default function MyTeamPage() {
  // TODO(백엔드/DB): "내가 영입한 선수 목록"은 서버에서 받아와야 함
  // 예) GET /api/my-team/players  (userId 기반)
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const players = useMemo<MyTeamPlayer[]>(() => mockMyTeamPlayers, []);

  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<MyTeamPosFilter>("ALL");
  const [sort, setSort] = useState<MyTeamSort>("score_desc");

  // TODO(백엔드/DB): 총 예산도 리그 설정/드래프트 설정에서 서버가 내려줘야 함
  // MVP에서는 임시로 260 고정
  const TOTAL_BUDGET = 260;
  const remaining = useMemo(() => computeRemainingBudget(TOTAL_BUDGET, players), [players]);

  const filtered = useMemo(() => {
    const f = filterMyTeam(players, query, pos);
    return sortMyTeam(f, sort);
  }, [players, query, pos, sort]);

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black text-white/70">PPA-DUN</div>
            <h1 className="mt-1 text-3xl font-black text-white">My Team</h1>
          </div>

          {/* ✅ Budget: 가로 길게(한 줄) */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
            <div className="text-sm font-extrabold text-white/70">Budget</div>
            <div className="text-xl font-black text-emerald-400">${remaining}</div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delayMs={60}>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {/* Search */}
            <div className="w-full lg:max-w-md">
              <div className="text-xs font-extrabold text-white/70">Search</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player or team..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
              />
            </div>

            {/* ✅ Animated Dropdown */}
            <div className="w-full lg:w-72">
              <Dropdown<MyTeamSort>
                label="Sort"
                value={sort}
                options={SORT_OPTIONS}
                onChange={setSort}
              />
            </div>
          </div>

          {/* Position chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {myTeamPositions.map((p) => {
              const active = pos === p;
              return (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-extrabold transition",
                    active
                      ? "bg-white text-black"
                      : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                  ].join(" ")}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1.8fr_.6fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_.9fr] bg-black/40 px-4 py-3 text-xs font-extrabold text-white/60">
              <div>Player</div>
              <div>Pos</div>
              <div>$</div>
              <div>Team</div>
              <div>AVG</div>
              <div>HR</div>
              <div>RBI</div>
              <div>SB</div>
              <div className="text-right">PPA-DUN Value</div>
            </div>

            <div className="bg-black/20">
              {loading && (
                <div className="p-4">
                  <Skeleton className="h-24" />
                </div>
              )}

              {!loading && error && (
                <div className="p-4 text-sm text-red-200">Failed to load my team: {error}</div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="p-4 text-sm text-white/70">No players found.</div>
              )}

              {!loading &&
                !error &&
                filtered.map((p) => (
                  <button
                    key={p.id}
                    // TODO(프론트 상호작용): 클릭하면 선수 정보 popup(modal) 띄우기
                    onClick={() => {}}
                    className="grid w-full grid-cols-[1.8fr_.6fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_.9fr] items-center px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5 transition"
                  >
                    <div className="font-semibold text-white">{p.name}</div>

                    <div>
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white/80">
                        {p.pos}
                      </span>
                    </div>

                    <div className="font-semibold text-white/80">{p.cost}</div>

                    {/* ✅ Team pastel badge */}
                    <div>
                      <span
                        className={[
                          "inline-flex items-center rounded-lg border px-2 py-1 text-xs font-extrabold",
                          teamBadgeClass(p.team),
                        ].join(" ")}
                      >
                        {p.team}
                      </span>
                    </div>

                    <div className="text-white/70">{formatAvg(p.avg)}</div>
                    <div className="text-amber-300 font-semibold">{p.hr || "—"}</div>
                    <div className="text-white/70">{p.rbi || "—"}</div>
                    <div className="text-amber-300 font-semibold">{p.sb || "—"}</div>

                    {/* ✅ Value highlight when >= 10 */}
                    <div className={`text-right text-sm font-black ${valueScoreClass(p.ppaValue)}`}>
                      {p.ppaValue.toFixed(1)}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          <div className="mt-3 text-xs text-white/45">
            TODO(백엔드/DB): 이 표의 선수/스탯/비딩 가격은 Draft 결과를 기반으로 서버에서 내려줘야 합니다.
          </div>
        </section>
      </FadeIn>
    </div>
  );
}