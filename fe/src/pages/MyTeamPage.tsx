import { useEffect, useState } from "react";
import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";
import Dropdown from "../components/ui/Dropdown";

import type { MyTeamPlayer, MyTeamPosFilter, MyTeamSort } from "../types/myteam";
import { formatAvg, teamBadgeClass, valueScoreClass } from "../features/myteam/utils";
import { apiGet } from "../lib/api";
import PlayerInfoModal from "../features/players/components/PlayerInfoModal";
import { DRAFT_ROOM_ID, MY_TEAM_ID } from "../lib/runtimeConfig";

type MyTeamPositionsResponse = {
  positions: MyTeamPosFilter[];
};

type MyTeamSortOption = {
  value: MyTeamSort;
  label: string;
};

type MyTeamSortOptionsResponse = {
  sorts: { value: string; label: string }[];
};

type MyTeamPlayersResponse = {
  items: MyTeamPlayer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
};

const DEFAULT_POSITIONS: MyTeamPosFilter[] = [
  "ALL",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "UTIL",
  "LF",
  "RF",
  "CF",
  "DH",
  "SP",
  "RP",
];

const DEFAULT_SORT_OPTIONS: MyTeamSortOption[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc", label: "By Value $" },
  { value: "avg_desc", label: "By AVG" },
  { value: "hr_desc", label: "By HR" },
  { value: "rbi_desc", label: "By RBI" },
  { value: "sb_desc", label: "By SB" },
];

function cleanSortLabel(label: string) {
  return label.replace(/\s*\((asc|desc)\)\s*/gi, "").trim();
}

function normalizeSortOptions(raw: { value: string; label: string }[]): MyTeamSortOption[] {
  const preferred: MyTeamSort[] = [
    "score_desc",
    "cost_desc",
    "avg_desc",
    "hr_desc",
    "rbi_desc",
    "sb_desc",
  ];

  const byValue = new Map(raw.map((option) => [option.value, option]));
  const seenLabels = new Set<string>();
  const normalized: MyTeamSortOption[] = [];

  for (const value of preferred) {
    const option = byValue.get(value);
    if (!option) continue;

    const label = cleanSortLabel(option.label);
    const key = label.toLowerCase();
    if (seenLabels.has(key)) continue;

    seenLabels.add(key);
    normalized.push({ value, label });
  }

  return normalized.length > 0 ? normalized : DEFAULT_SORT_OPTIONS;
}

export default function MyTeamPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<MyTeamPlayer[]>([]);

  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<MyTeamPosFilter>("ALL");
  const [sort, setSort] = useState<MyTeamSort>("score_desc");

  const [positions, setPositions] = useState<MyTeamPosFilter[]>(DEFAULT_POSITIONS);
  const [sortOptions, setSortOptions] = useState<MyTeamSortOption[]>(DEFAULT_SORT_OPTIONS);
  const [remainingBudget, setRemainingBudget] = useState(260);
  const [spentBudget, setSpentBudget] = useState(0);
  const [totalBudget, setTotalBudget] = useState(260);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      apiGet<MyTeamPositionsResponse>("/api/my-team/filters/positions", undefined, controller.signal),
      apiGet<MyTeamSortOptionsResponse>("/api/my-team/filters/sorts", undefined, controller.signal),
    ])
      .then(([positionData, sortData]) => {
        if (controller.signal.aborted) return;

        if (positionData.positions.length > 0) {
          setPositions(positionData.positions);
          setPos((prev) => (positionData.positions.includes(prev) ? prev : "ALL"));
        }

        const normalizedSorts = normalizeSortOptions(sortData.sorts);
        setSortOptions(normalizedSorts);
        setSort((prev) =>
          normalizedSorts.some((option) => option.value === prev)
            ? prev
            : normalizedSorts[0]?.value ?? "score_desc"
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    apiGet<MyTeamPlayersResponse>(
      "/api/my-team/players",
      {
        query: query.trim() || undefined,
        position: pos,
        sort,
        page: 1,
        limit: 200,
        roomId: DRAFT_ROOM_ID,
        myTeamId: MY_TEAM_ID,
      },
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setPlayers(data.items);
        setRemainingBudget(data.remainingBudget);
        setSpentBudget(data.spentBudget);
        setTotalBudget(data.totalBudget);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setPlayers([]);
        setError(err instanceof Error ? err.message : "Failed to load my team players");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [query, pos, sort]);

  const openPlayerInfo = (rawPlayerId: string) => {
    const parsed = Number(rawPlayerId);
    if (!Number.isFinite(parsed)) {
      setError("Invalid player id");
      return;
    }
    setProfilePlayerId(parsed);
  };

  const closePlayerInfo = () => {
    setProfilePlayerId(null);
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black text-white/70">PPA-DUN</div>
            <h1 className="mt-1 text-3xl font-black text-white">My Team</h1>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
            <div className="text-sm font-extrabold text-white/70">Budget</div>
            <div className="text-xl font-black text-emerald-400">${remainingBudget}</div>
            <div className="text-xs font-semibold text-white/50">
              (${spentBudget} / ${totalBudget} spent)
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delayMs={60} className="relative z-40">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-md">
              <div className="text-xs font-extrabold text-white/70">Search</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player or team..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
              />
            </div>

            <div className="w-full lg:w-72">
              <Dropdown<MyTeamSort>
                label="Sort"
                value={sort}
                options={sortOptions}
                onChange={setSort}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {positions.map((position) => {
              const active = pos === position;
              return (
                <button
                  key={position}
                  onClick={() => setPos(position)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-extrabold transition",
                    active
                      ? "bg-white text-black"
                      : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                  ].join(" ")}
                >
                  {position}
                </button>
              );
            })}
          </div>

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

              {!loading && !error && players.length === 0 && (
                <div className="p-4 text-sm text-white/70">No players found.</div>
              )}

              {!loading &&
                !error &&
                players.map((player) => (
                  <div
                    key={player.id}
                    className="grid w-full grid-cols-[1.8fr_.6fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_.9fr] items-center px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/5"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => openPlayerInfo(player.id)}
                        className="rounded-md border border-transparent px-2 py-1 -mx-2 -my-1 font-semibold text-white transition hover:border-white/35 hover:bg-white/5 hover:text-amber-200 focus-visible:border-white/45 focus-visible:bg-white/10 focus-visible:outline-none"
                      >
                        {player.name}
                      </button>
                    </div>

                    <div>
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white/80">
                        {player.pos}
                      </span>
                    </div>

                    <div className="font-semibold text-white/80">{player.cost}</div>

                    <div>
                      <span
                        className={[
                          "inline-flex items-center rounded-lg border px-2 py-1 text-xs font-extrabold",
                          teamBadgeClass(player.team),
                        ].join(" ")}
                      >
                        {player.team}
                      </span>
                    </div>

                    <div className="text-white/70">{formatAvg(player.avg)}</div>
                    <div className="font-semibold text-amber-300">{player.hr ?? "-"}</div>
                    <div className="text-white/70">{player.rbi ?? "-"}</div>
                    <div className="font-semibold text-amber-300">{player.sb ?? "-"}</div>

                    <div className={`text-right text-sm font-black ${valueScoreClass(player.ppaValue)}`}>
                      {player.ppaValue.toFixed(1)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      </FadeIn>

      <PlayerInfoModal
        open={profilePlayerId !== null}
        playerId={profilePlayerId}
        onClose={closePlayerInfo}
      />
    </div>
  );
}
