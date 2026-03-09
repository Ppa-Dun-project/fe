import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";
import Dropdown from "../components/ui/Dropdown";
import { useAuth } from "../lib/auth";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { DRAFT_ROOM_ID } from "../lib/runtimeConfig";

import type {
  DraftConfigLocal,
  DraftPick,
  DraftPlayer,
  DraftPositionFilter,
  DraftSort,
  DraftTeam,
} from "../types/draft";
type DraftPosition = DraftPlayer["positions"][number];

import {
  buildSlotTemplate,
  calculateCurrentRound,
  calculateRemainingBudget,
  clampRosterSize,
  draftCostClass,
  formatAvg,
  getPlayerDraftStatus,
  mlbTeamBadgeClass,
  readDraftConfig,
  valueClass,
} from "../features/draft/utils";

import DraftRoomBoard from "../features/draft/components/DraftRoomBoard";
import AddBidModal from "../features/draft/components/AddBidModal";
import TakenBidModal from "../features/draft/components/TakenBidModal";
import PlayerComparisonModal from "../features/draft/components/PlayerComparisonModal";
import PlayerInfoModal from "../features/players/components/PlayerInfoModal";

const BACKEND_LIST_LIMIT = 200;

const DEFAULT_POSITION_FILTERS: DraftPositionFilter[] = [
  "ALL",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "UTIL",
  "SP",
  "RP",
];

const DEFAULT_SORT_OPTIONS: { value: DraftSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc", label: "By Draft Cost" },
  { value: "avg_desc", label: "By AVG" },
  { value: "hr_desc", label: "By HR" },
  { value: "rbi_desc", label: "By RBI" },
  { value: "sb_desc", label: "By SB" },
];

type DraftConfigResponse = {
  leagueType: string;
  budget: number;
  rosterPlayers: number;
  myTeamName: string;
  oppTeamName: string;
  opponentsCount: number;
  oppTeamNames: string[];
};

type DraftSortOptionResponse = {
  value: string;
  label: string;
};

type DraftBootstrapResponse = {
  config: DraftConfigResponse;
  teams: DraftTeam[];
  positionFilters: string[];
  sortOptions: DraftSortOptionResponse[];
  picks: DraftPick[];
};

type DraftPlayersResponse = {
  items: DraftPlayer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type DraftPicksResponse = {
  roomId: string;
  items: DraftPick[];
};

type DraftPickUpsertIn = {
  playerId: string;
  draftedByTeamId: string;
  slotPos: DraftPosition;
  bid: number | null;
  type: DraftPick["type"];
};

function toInitialConfig(local: DraftConfigLocal): DraftConfigResponse {
  return {
    leagueType: local.leagueType ?? "standard",
    budget: local.budget ?? 260,
    rosterPlayers: local.rosterPlayers ?? 12,
    myTeamName: (local.myTeamName ?? "My Team").trim() || "My Team",
    oppTeamName: (local.oppTeamName ?? "Team A").trim() || "Team A",
    opponentsCount: local.opponentsCount ?? 5,
    oppTeamNames: local.oppTeamNames ?? [],
  };
}

function cleanSortLabel(label: string) {
  return label.replace(/\s*\((asc|desc)\)\s*/gi, "").trim();
}

function normalizeSortOptions(raw: DraftSortOptionResponse[]) {
  const preferred: DraftSort[] = [
    "score_desc",
    "cost_desc",
    "avg_desc",
    "hr_desc",
    "rbi_desc",
    "sb_desc",
  ];

  const byValue = new Map(raw.map((option) => [option.value, option]));
  const seenLabels = new Set<string>();
  const normalized: { value: DraftSort; label: string }[] = [];

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

function normalizePositionFilters(raw: string[]): DraftPositionFilter[] {
  const allowed = new Set(DEFAULT_POSITION_FILTERS);
  const normalized = raw.filter((position): position is DraftPositionFilter =>
    allowed.has(position as DraftPositionFilter)
  );
  return normalized.length > 0 ? normalized : DEFAULT_POSITION_FILTERS;
}

function resolveDraftSlotPosition(player: DraftPlayer): DraftPosition {
  return (player.positions[0] ?? "UTIL") as DraftPosition;
}

export default function DraftPage() {
  const authed = useAuth();
  const [searchParams] = useSearchParams();
  const draftRoomTopRef = useRef<HTMLDivElement | null>(null);

  const localConfig = useMemo(() => readDraftConfig(), []);

  const [config, setConfig] = useState<DraftConfigResponse>(() => toInitialConfig(localConfig));
  const [teams, setTeams] = useState<DraftTeam[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);

  const [query, setQuery] = useState(() => searchParams.get("query")?.trim() ?? "");
  const [position, setPosition] = useState<DraftPositionFilter>("ALL");
  const [sort, setSort] = useState<DraftSort>("score_desc");

  const [positionFilters, setPositionFilters] =
    useState<DraftPositionFilter[]>(DEFAULT_POSITION_FILTERS);
  const [sortOptions, setSortOptions] =
    useState<{ value: DraftSort; label: string }[]>(DEFAULT_SORT_OPTIONS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [recommendationNoticeOpen, setRecommendationNoticeOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);

  const [addTarget, setAddTarget] = useState<DraftPlayer | null>(null);
  const [takenTarget, setTakenTarget] = useState<DraftPlayer | null>(null);

  const rosterSlots = useMemo(() => clampRosterSize(config.rosterPlayers), [config.rosterPlayers]);
  const slotTemplate = useMemo(() => buildSlotTemplate(rosterSlots), [rosterSlots]);

  const playersById = useMemo<Record<string, DraftPlayer>>(
    () => Object.fromEntries(players.map((player) => [player.id, player])),
    [players]
  );

  const myTeam = teams.find((team) => team.isMine) ?? teams[0] ?? null;

  const remainingBudgetByTeam = useMemo(() => {
    const spentByTeam = new Map<string, number>();
    for (const pick of picks) {
      if (typeof pick.bid !== "number") continue;
      spentByTeam.set(pick.draftedByTeamId, (spentByTeam.get(pick.draftedByTeamId) ?? 0) + pick.bid);
    }
    return Object.fromEntries(
      teams.map((team) => [
        team.id,
        Math.max(0, config.budget - (spentByTeam.get(team.id) ?? 0)),
      ])
    ) as Record<string, number>;
  }, [teams, picks, config.budget]);

  const remainingBudget = useMemo(() => {
    if (!myTeam) return config.budget;
    return remainingBudgetByTeam[myTeam.id] ?? calculateRemainingBudget(config.budget, myTeam.id, picks);
  }, [config.budget, myTeam, picks, remainingBudgetByTeam]);

  const currentRound = useMemo(() => {
    if (teams.length === 0) return 1;
    return calculateCurrentRound(teams.length, rosterSlots, picks);
  }, [teams.length, rosterSlots, picks]);

  const selectedA = useMemo(
    () => players.find((player) => player.id === compareAId) ?? null,
    [players, compareAId]
  );
  const selectedB = useMemo(
    () => players.find((player) => player.id === compareBId) ?? null,
    [players, compareBId]
  );

  const openAddModal = (player: DraftPlayer) => {
    setAddTarget(player);
  };

  const openTakenModal = (player: DraftPlayer) => {
    setTakenTarget(player);
  };

  const closeAddModal = () => {
    setAddTarget(null);
  };

  const closeTakenModal = () => {
    setTakenTarget(null);
  };

  useEffect(() => {
    const controller = new AbortController();

    apiGet<DraftBootstrapResponse>(
      "/api/draft/bootstrap",
      {
        leagueType: localConfig.leagueType ?? "standard",
        budget: localConfig.budget ?? 260,
        rosterPlayers: localConfig.rosterPlayers ?? 12,
        myTeamName: localConfig.myTeamName ?? "My Team",
        oppTeamName: localConfig.oppTeamName ?? "Team A",
        opponentsCount: localConfig.opponentsCount ?? 5,
        oppTeamNames: (localConfig.oppTeamNames ?? []).join(","),
        roomId: DRAFT_ROOM_ID,
      },
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;

        setConfig(data.config);
        setTeams(data.teams);
        setPicks(data.picks);

        const nextPositions = normalizePositionFilters(data.positionFilters);
        setPositionFilters(nextPositions);
        setPosition((prev) => (nextPositions.includes(prev) ? prev : nextPositions[0]));

        const nextSortOptions = normalizeSortOptions(data.sortOptions);
        setSortOptions(nextSortOptions);
        setSort((prev) =>
          nextSortOptions.some((option) => option.value === prev)
            ? prev
            : nextSortOptions[0]?.value ?? "score_desc"
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to bootstrap draft data");
      });

    return () => controller.abort();
  }, [localConfig]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    apiGet<DraftPlayersResponse>(
      "/api/draft/players",
      {
        query: query.trim() || undefined,
        position,
        sort,
        page: 1,
        limit: BACKEND_LIST_LIMIT,
      },
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setPlayers(data.items);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setPlayers([]);
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [query, position, sort]);

  const handleCompareToggle = (playerId: string) => {
    if (!authed) return;
    if (comparisonOpen) setComparisonOpen(false);

    if (compareAId === playerId) {
      setCompareAId(compareBId);
      setCompareBId(null);
      return;
    }

    if (compareBId === playerId) {
      setCompareBId(null);
      return;
    }

    if (!compareAId) {
      setCompareAId(playerId);
      return;
    }

    if (!compareBId) {
      setCompareBId(playerId);
      return;
    }

    setCompareBId(playerId);
  };

  const clearCompare = () => {
    setCompareAId(null);
    setCompareBId(null);
    setComparisonOpen(false);
  };

  const clearCompareA = () => {
    setCompareAId(null);
    setComparisonOpen(false);
  };

  const clearCompareB = () => {
    setCompareBId(null);
    setComparisonOpen(false);
  };

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

  const handleRemovePick = (pick: DraftPick) => {
    void apiDelete<DraftPicksResponse>(`/api/draft/picks/${pick.playerId}`, { roomId: DRAFT_ROOM_ID })
      .then((data) => setPicks(data.items))
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to remove pick");
      });
  };

  const handleAddFinish = (bid: number) => {
    if (!addTarget || !myTeam) return;

    const payload: DraftPickUpsertIn = {
      playerId: addTarget.id,
      draftedByTeamId: myTeam.id,
      slotPos: resolveDraftSlotPosition(addTarget),
      bid,
      type: "mine",
    };

    void apiPost<DraftPicksResponse, DraftPickUpsertIn>(
      "/api/draft/picks",
      payload,
      { roomId: DRAFT_ROOM_ID, rosterPlayers: rosterSlots }
    )
      .then((data) => {
        setPicks(data.items);
        closeAddModal();
        draftRoomTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to save draft pick");
      });
  };

  const handleTakenFinish = (draftedByTeamId: string, bid: number) => {
    if (!takenTarget) return;

    const payload: DraftPickUpsertIn = {
      playerId: takenTarget.id,
      draftedByTeamId,
      slotPos: resolveDraftSlotPosition(takenTarget),
      bid,
      type: "taken",
    };

    void apiPost<DraftPicksResponse, DraftPickUpsertIn>(
      "/api/draft/picks",
      payload,
      { roomId: DRAFT_ROOM_ID, rosterPlayers: rosterSlots }
    )
      .then((data) => {
        setPicks(data.items);
        closeTakenModal();
        draftRoomTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to save draft pick");
      });
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-black text-white/70">PPA-DUN</div>
            <h1 className="mt-1 text-3xl font-black text-white">Draft Room</h1>
            <p className="mt-2 text-sm text-white/60">
              {String(config.leagueType ?? "standard").toUpperCase()} - ${config.budget} Budget - {rosterSlots} Players
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs font-extrabold text-white/60">Remaining Budget</div>
            <div className="mt-1 text-2xl font-black text-emerald-400">${remainingBudget}</div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delayMs={60}>
        <div ref={draftRoomTopRef}>
          {authed ? (
            <DraftRoomBoard
              teams={teams}
              slotTemplate={slotTemplate}
              picks={picks}
              playersById={playersById}
              currentRound={currentRound}
              totalRounds={rosterSlots}
              authed={authed}
              onRemovePick={handleRemovePick}
            />
          ) : (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-black text-white">Guest View</div>
              <div className="mt-2 text-sm text-white/60">
                Sign in to use the live draft room board and Add / Taken actions.
              </div>
            </section>
          )}
        </div>
      </FadeIn>

      <FadeIn delayMs={100} className="relative z-40">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-md">
              <div className="text-xs font-extrabold text-white/70">Search</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player name..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
              />
            </div>

            <div className="w-full lg:w-72">
              <Dropdown<DraftSort>
                label="Sort"
                value={sort}
                options={sortOptions}
                onChange={setSort}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {positionFilters.map((filterValue) => {
              const active = position === filterValue;
              return (
                <button
                  key={filterValue}
                  onClick={() => setPosition(filterValue)}
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

            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
              Remaining Budget: ${remainingBudget}
            </div>
          </div>
        </section>
      </FadeIn>

      <FadeIn delayMs={110}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setRecommendationNoticeOpen(true)}
            className="rounded-xl border border-fuchsia-400/35 bg-fuchsia-500/12 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            title="Recommendation popup will be connected later"
          >
            PPA-DUN Recommendation
          </button>
        </div>
      </FadeIn>

      <FadeIn delayMs={120}>
        <section className="rounded-2xl border border-fuchsia-500/55 bg-[#1b1228] p-4 shadow-[0_0_22px_rgba(168,85,247,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="rounded-xl bg-fuchsia-500/15 px-4 py-3 ring-1 ring-fuchsia-300/40 lg:min-w-[170px]">
                <div className="text-sm font-black text-fuchsia-200">Compare</div>
                <div className="mt-0.5 text-[11px] font-bold text-white/65">Select 2 players</div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
                <div className="min-w-0 w-full rounded-xl border border-emerald-400/50 bg-emerald-500/12 px-3 py-2 shadow-[0_0_16px_rgba(16,185,129,0.18)] sm:w-[300px]">
                  {selectedA ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs text-white/80">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 font-black text-emerald-100">A</span>
                          <span className="truncate font-black text-white">{selectedA.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={clearCompareA}
                          className="grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-black/20 text-[10px] font-black text-white/80 transition hover:bg-white/15"
                          aria-label="Remove player A from compare"
                          title="Remove player A"
                        >
                          X
                        </button>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-white/70">
                        {selectedA.positions.join("/")} - {selectedA.team} - ${selectedA.recommendedBid}
                      </div>
                      <div className="mt-1 text-[10px] text-white/55">
                        AVG {formatAvg(selectedA.avg)} | HR {selectedA.hr ?? "-"} | RBI {selectedA.rbi ?? "-"} | SB {selectedA.sb ?? "-"}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs font-bold text-white/55">Select player A</div>
                  )}
                </div>

                <div className="text-center text-xs font-black text-fuchsia-200 sm:px-1">VS</div>

                <div className="min-w-0 w-full rounded-xl border border-emerald-400/50 bg-emerald-500/12 px-3 py-2 shadow-[0_0_16px_rgba(16,185,129,0.18)] sm:w-[300px]">
                  {selectedB ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs text-white/80">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 font-black text-emerald-100">B</span>
                          <span className="truncate font-black text-white">{selectedB.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={clearCompareB}
                          className="grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-black/20 text-[10px] font-black text-white/80 transition hover:bg-white/15"
                          aria-label="Remove player B from compare"
                          title="Remove player B"
                        >
                          X
                        </button>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-white/70">
                        {selectedB.positions.join("/")} - {selectedB.team} - ${selectedB.recommendedBid}
                      </div>
                      <div className="mt-1 text-[10px] text-white/55">
                        AVG {formatAvg(selectedB.avg)} | HR {selectedB.hr ?? "-"} | RBI {selectedB.rbi ?? "-"} | SB {selectedB.sb ?? "-"}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs font-bold text-white/55">Select player B</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                type="button"
                onClick={clearCompare}
                disabled={!selectedA && !selectedB}
                className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-xs font-black text-white/80 transition hover:bg-white/10 disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setComparisonOpen(true)}
                disabled={!selectedA || !selectedB || !authed}
                className="rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-black text-white transition hover:bg-fuchsia-500 disabled:opacity-40"
                title={!authed ? "Sign in required" : "Open player comparison"}
              >
                Compare
              </button>
            </div>
          </div>
        </section>
      </FadeIn>

      <FadeIn delayMs={140}>
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-[.4fr_1.8fr_.6fr_.8fr_.8fr_.8fr_.8fr_.8fr_.9fr_1.3fr_1.1fr_.9fr] bg-black/40 px-4 py-3 text-xs font-extrabold text-white/60">
            <div>#</div>
            <div>Player</div>
            <div>Pos</div>
            <div>Draft Cost</div>
            <div>Team</div>
            <div>AVG</div>
            <div>HR</div>
            <div>RBI</div>
            <div>SB</div>
            <div>PPA-DUN Value</div>
            <div>Action</div>
            <div>Compare</div>
          </div>

          <div className="bg-black/20">
            {loading && (
              <div className="p-4">
                <Skeleton className="h-24" />
              </div>
            )}

            {!loading && error && <div className="p-4 text-sm text-red-200">Failed to load players: {error}</div>}

            {!loading && !error && players.length === 0 && (
              <div className="p-4 text-sm text-white/70">No results. Try another search or filter.</div>
            )}

            {!loading &&
              !error &&
              players.map((player, idx) => {
                const status = getPlayerDraftStatus(player.id, picks, teams);
                const compareAActive = compareAId === player.id;
                const compareBActive = compareBId === player.id;
                const compareRole = compareAActive ? "A" : compareBActive ? "B" : null;
                const compareActive = Boolean(compareRole);

                return (
                  <div
                    key={player.id}
                    className={[
                      "grid grid-cols-[.4fr_1.8fr_.6fr_.8fr_.8fr_.8fr_.8fr_.8fr_.9fr_1.3fr_1.1fr_.9fr] items-center px-4 py-3 text-sm text-white/85 transition",
                      compareActive
                        ? "relative z-[1] my-1 rounded-xl border border-emerald-400/75 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                        : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className="text-white/45">{idx + 1}</div>

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
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/80">
                        {player.positions[0]}
                      </span>
                    </div>

                    <div className={draftCostClass(authed)}>${player.recommendedBid}</div>

                    <div>
                      <span
                        className={[
                          "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-extrabold",
                          mlbTeamBadgeClass(player.team),
                        ].join(" ")}
                      >
                        {player.team}
                      </span>
                    </div>

                    <div className="text-white/70">{formatAvg(player.avg)}</div>
                    <div className="font-semibold text-amber-300">{player.hr ?? "-"}</div>
                    <div className="text-white/70">{player.rbi ?? "-"}</div>
                    <div className="font-semibold text-amber-300">{player.sb ?? "-"}</div>

                    <div className={`font-black ${valueClass(player.ppaValue, authed)}`}>
                      {player.ppaValue.toFixed(1)}
                    </div>

                    <div className="flex items-center gap-2">
                      {status.kind === "mine" ? (
                        <div className="rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-black text-sky-200 ring-1 ring-sky-400/20">
                          {status.label}
                        </div>
                      ) : status.kind === "taken" ? (
                        <div className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-200 ring-1 ring-rose-400/20">
                          {status.label}
                        </div>
                      ) : authed ? (
                        <>
                          <button
                            onClick={() => openAddModal(player)}
                            className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-400/20 transition hover:bg-emerald-500/25"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => openTakenModal(player)}
                            className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-200 ring-1 ring-rose-400/20 transition hover:bg-rose-500/25"
                          >
                            Taken
                          </button>
                        </>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/40 blur-[1px]">
                          Sign in required
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        disabled={!authed}
                        onClick={() => handleCompareToggle(player.id)}
                        className={[
                          "relative h-6 w-14 rounded-full border transition",
                          compareActive
                            ? "border-emerald-300/70 bg-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                          !authed ? "opacity-40" : "",
                        ].join(" ")}
                        title={!authed ? "Sign in required" : compareRole ? `Selected ${compareRole}` : "Select for compare"}
                      >
                        <span
                          className={[
                            "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200",
                            compareActive ? "translate-x-8" : "translate-x-0",
                          ].join(" ")}
                        />
                        {compareRole && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-950">
                            {compareRole}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="border-t border-white/10 px-4 py-3 text-xs text-white/45">
            Players and draft picks are loaded from backend APIs.
          </div>
        </section>
      </FadeIn>

      {addTarget && (
        <AddBidModal
          key={`add-${addTarget.id}`}
          open={true}
          player={addTarget}
          remainingBudget={remainingBudget}
          onClose={closeAddModal}
          onConfirm={handleAddFinish}
        />
      )}

      {takenTarget && (
        <TakenBidModal
          key={`taken-${takenTarget.id}`}
          open={true}
      player={takenTarget}
      teams={teams}
      remainingBudgetByTeam={remainingBudgetByTeam}
      onClose={closeTakenModal}
      onConfirm={handleTakenFinish}
    />
  )}

      <PlayerComparisonModal
        open={comparisonOpen && Boolean(selectedA) && Boolean(selectedB)}
        playerA={selectedA}
        playerB={selectedB}
        onClose={() => setComparisonOpen(false)}
      />

      <PlayerInfoModal
        open={profilePlayerId !== null}
        playerId={profilePlayerId}
        onClose={closePlayerInfo}
      />

      {recommendationNoticeOpen && (
        <div className="fixed inset-0 z-[72] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Close recommendation notice"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setRecommendationNoticeOpen(false)}
          />
          <div className="relative w-[92%] max-w-sm rounded-3xl border border-fuchsia-400/30 bg-[#130f1d] p-5 shadow-2xl">
            <div className="text-lg font-black text-white">PPA-DUN Recommendation</div>
            <div className="mt-2 text-sm font-semibold text-fuchsia-100">
              Planned for development in V2.
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setRecommendationNoticeOpen(false)}
                className="rounded-full border border-fuchsia-300/30 bg-fuchsia-600 px-5 py-1.5 text-sm font-bold text-white transition hover:bg-fuchsia-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
