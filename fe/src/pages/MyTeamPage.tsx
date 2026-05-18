// My Team page (login required)
// - Operates per draft session: GET /api/my-team/players?sessionId=<id>
// - On entry, calls GET /api/draft/sessions to fetch the user's session list →
//   uses URL ?sessionId if present and owned by the user, otherwise defaults to the most recent session
// - Filtering / sorting / searching all happen on the frontend (backend only provides raw data)
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";
import Dropdown from "../components/ui/Dropdown";

import type { MyTeamPlayer, MyTeamPosFilter, MyTeamSort } from "../types/myteam";
import type {
  DraftPlayerValue,
  SessionSummary,
  DraftPick,
} from "../types/draft";
import {
  filterMyTeam,
  formatAvg,
  sortMyTeam,
  synthesizeUnsavedMyTeam,
} from "../features/myteam/utils";
import { mlbTeamBadgeClass } from "../features/draft/utils";
import {
  getActiveDraftSessionId,
  normalizeDraftPicks,
  readUnsavedDraftStorage,
  type UnsavedDraft,
  type DraftPlayerValuesResponse,
  type DraftPlayersResponse,
} from "../features/draft/draftHelpers";
import { formatPpa, ppaValueClass } from "../utils/playerValue";
import { apiGet, apiGetAuth } from "../lib/api";
import PlayerInfoModal from "../features/players/components/PlayerInfoModal";

// Backend response type for GET /api/my-team/players
type MyTeamPlayersResponse = {
  items: MyTeamPlayer[];
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
};

// Backend response type for GET /api/draft/sessions
type SessionsListResponse = {
  items: SessionSummary[];
};

// Bundles budget info into a single object (collapsing three useState calls into one)
type Budget = { total: number; spent: number; remaining: number };

const INITIAL_BUDGET: Budget = { total: 260, spent: 0, remaining: 260 };

// Position filter options (fixed)
const POSITION_FILTERS: MyTeamPosFilter[] = [
  "ALL", "C", "1B", "2B", "3B", "SS", "OF", "UTIL",
  "LF", "RF", "CF", "DH", "SP", "RP",
];

// Sort options (fixed)
const SORT_OPTIONS: { value: MyTeamSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc", label: "By Value $" },
  { value: "avg_desc", label: "By AVG/ERA" },
  { value: "hr_desc", label: "By HR/SO" },
  { value: "rbi_desc", label: "By RBI/W" },
  { value: "sb_desc", label: "By SB/SV" },
];

// Table column grid definition (shared by the header and each row)
const TABLE_GRID_COLS =
  "grid-cols-[1.8fr_.6fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_.9fr]";

function isPitcher(player: MyTeamPlayer) {
  return player.playerType === "pitcher";
}

function formatNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(digits);
}

// Parses the unsaved-draft JSON from sessionStorage. Normalizes picks to handle legacy ID formats.
// Returns null on invalid payload / empty picks so the caller can easily fall back.
function parseUnsavedDraftFromStorage(): UnsavedDraft | null {
  const raw = readUnsavedDraftStorage();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UnsavedDraft;
    if (!parsed?.config || !Array.isArray(parsed.picks)) return null;
    return {
      ...parsed,
      picks: normalizeDraftPicks(parsed.picks as DraftPick[]),
    };
  } catch {
    return null;
  }
}

export default function MyTeamPage() {
  // URL ?sessionId — the source of truth. Used so the same session is shown after refresh/share.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSessionIdRaw = searchParams.get("sessionId");

  // Session list load state (sessions === null = not yet fetched)
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // The session ID currently being viewed (determined once the sessions load finishes)
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Unsaved draft (sessionStorage `ppadun_unsaved_draft`).
  // Used as a fallback when there's no active session — so the Draft page's live picks
  // can be displayed as-is without a backend round-trip.
  const [unsavedDraft, setUnsavedDraft] = useState<UnsavedDraft | null>(null);

  // Player data loading / error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player list and budget info fetched from the backend
  const [players, setPlayers] = useState<MyTeamPlayer[]>([]);
  const [budget, setBudget] = useState<Budget>(INITIAL_BUDGET);

  // Search query / position filter / sort state
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<MyTeamPosFilter>("ALL");
  const [sort, setSort] = useState<MyTeamSort>("score_desc");

  // Player info modal state (selected player ID)
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);
  const [profilePlayerType, setProfilePlayerType] = useState<"batter" | "pitcher">("batter");

  // ── Step 1: fetch session list + decide on sessionId or unsavedDraft ──
  // Priority:
  //   1) activeDraftSessionId (sessionStorage) — the saved session the user is
  //      currently viewing on the Draft page. Reinforces the "My Team mirrors the active draft" semantics.
  //   2) URL ?sessionId — direct link / bookmark case (only when it's an owned session).
  //   3) sessionStorage unsaved draft — if there's an in-progress draft on DraftPage
  //      that hasn't been Saved yet, show it via client-side synthesis.
  //   4) Otherwise → "no active draft" empty state.
  useEffect(() => {
    const controller = new AbortController();

    // The unsaved draft only requires reading sessionStorage (no backend call),
    // so parse it once up front, independently of the session list fetch.
    const parsedUnsaved = parseUnsavedDraftFromStorage();

    apiGetAuth<SessionsListResponse>(
      "/api/draft/sessions",
      undefined,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const items = data.items ?? [];
        setSessions(items);

        // activeDraftSessionId takes top priority if it's a valid owned session.
        const activeId = getActiveDraftSessionId();
        if (activeId !== null && items.some((s) => s.id === activeId)) {
          setSessionId(activeId);
          const next = new URLSearchParams(searchParams);
          next.set("sessionId", String(activeId));
          setSearchParams(next, { replace: true });
          return;
        }

        // No active draft → trust the URL only. Even a stale URL is fine if it
        // points at an owned session (bookmark / share scenario).
        const urlIdNum = urlSessionIdRaw ? Number(urlSessionIdRaw) : NaN;
        const urlIsValid =
          Number.isFinite(urlIdNum) && items.some((s) => s.id === urlIdNum);
        if (urlIsValid) {
          setSessionId(urlIdNum);
          return;
        }

        // No saved session and no URL → fall back to the unsaved draft if there is one.
        if (parsedUnsaved) {
          setUnsavedDraft(parsedUnsaved);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setSessions([]);
        setSessionsError(
          err instanceof Error ? err.message : "Failed to load draft sessions"
        );
      });

    return () => controller.abort();
    // Run once on mount only — do not refetch when URL/searchParams change
    // (any URL change here is the result of our own setSearchParams call).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: once sessionId is decided, load the My Team data for that session ──
  // Extracted into a callback so it can be reused — visibilitychange uses the same logic to refetch.
  const fetchTeam = useCallback(
    (signal?: AbortSignal) => {
      if (sessionId === null) return;
      setLoading(true);
      setError(null);
      apiGetAuth<MyTeamPlayersResponse>(
        "/api/my-team/players",
        { sessionId },
        signal,
      )
        .then((data) => {
          if (signal?.aborted) return;
          setPlayers(data.items);
          setBudget({
            total: data.totalBudget,
            spent: data.spentBudget,
            remaining: data.remainingBudget,
          });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error(err);
          setPlayers([]);
          setError(err instanceof Error ? err.message : "Failed to load my team");
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [sessionId],
  );

  useEffect(() => {
    if (sessionId === null) return;
    const controller = new AbortController();
    fetchTeam(controller.signal);
    return () => controller.abort();
  }, [sessionId, fetchTeam]);

  // Refetch the latest pick data on tab switch / page re-visibility.
  // Reflects results pushed by DraftPage's auto-save immediately — avoids staleness when switching between the two pages.
  useEffect(() => {
    if (sessionId === null) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchTeam();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [sessionId, fetchTeam]);

  // ── Step 3 (unsaved mode): synthesize unsaved draft → public players + values ──
  // Since the backend /api/my-team/players only knows about saved sessions, pre-Save picks
  // are merged client-side from the sessionStorage unsavedDraft + the /api/draft/players response
  // to produce the same shape.
  useEffect(() => {
    if (unsavedDraft === null) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const league = unsavedDraft.config.leagueType;
    const playersPath =
      league === "AL" || league === "NL"
        ? `/api/draft/players?league=${league}`
        : "/api/draft/players";

    Promise.all([
      apiGet<DraftPlayersResponse>(playersPath, undefined, controller.signal),
      apiGetAuth<DraftPlayerValuesResponse>(
        "/api/draft/players/value",
        undefined,
        controller.signal,
      ).catch((err: unknown) => {
        // values are auxiliary info — on failure, players just render with ppaValue=0.
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        console.error("Failed to load player values:", err);
        return { items: [] as DraftPlayerValue[] };
      }),
    ])
      .then(([publicResp, valuesResp]) => {
        if (controller.signal.aborted) return;
        const synthesized = synthesizeUnsavedMyTeam(
          unsavedDraft,
          publicResp.items ?? [],
          valuesResp.items ?? [],
        );
        setPlayers(synthesized.items);
        setBudget({
          total: synthesized.totalBudget,
          spent: synthesized.spentBudget,
          remaining: synthesized.remainingBudget,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setPlayers([]);
        setError(err instanceof Error ? err.message : "Failed to load my team");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [unsavedDraft]);

  // Meta info for the session currently being viewed (used to show its name next to the title)
  const activeSession = useMemo(
    () => sessions?.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );

  // Label to display in unsaved mode (no server id/name yet since it's pre-save).
  const unsavedSessionLabel = unsavedDraft
    ? `${unsavedDraft.config.myTeamName ?? "My Team"} (Unsaved Draft)`
    : null;

  // Zero-session empty state — excluded when an unsaved draft exists since that path takes over.
  const noSessions =
    sessions !== null && sessions.length === 0 && unsavedDraft === null;
  // Sessions exist but there's no active draft to display (after New/Discard on the
  // Draft page, or on first entry with no URL/active session). Rather than silently
  // pulling up an old session, we show an explicit message — preserving the
  // "My Team = current draft" semantics.
  const noActiveDraft =
    sessions !== null &&
    sessions.length > 0 &&
    sessionId === null &&
    unsavedDraft === null;
  const sessionsLoading = sessions === null && sessionsError === null;

  // Client-side filter + sort (computed in memory without re-hitting the backend)
  const visiblePlayers = useMemo(
    () => sortMyTeam(filterMyTeam(players, query, pos), sort),
    [players, query, pos, sort]
  );

  return (
    <div className="space-y-6">
      {/* Top: title + budget card */}
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black text-white/70">PPA-DUN</div>
            <h1 className="mt-1 text-3xl font-black text-white">My Team</h1>
            {activeSession && (
              <div className="mt-1 text-sm font-semibold text-white/60">
                Session: <span className="text-white/85">{activeSession.name}</span>
              </div>
            )}
            {unsavedSessionLabel && (
              <div className="mt-1 text-sm font-semibold text-white/60">
                Session: <span className="text-white/85">{unsavedSessionLabel}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
            <div className="text-sm font-extrabold text-white/70">Budget</div>
            <div className="text-xl font-black text-emerald-400">${budget.remaining}</div>
            <div className="text-xs font-semibold text-white/50">
              (${budget.spent} / ${budget.total} spent)
            </div>
          </div>
        </div>
      </FadeIn>

      {/* When there are no sessions: show only the info card and skip the main table */}
      {noSessions && (
        <FadeIn delayMs={60}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-lg font-black text-white">No draft sessions yet</h2>
            <p className="mt-2 text-sm font-semibold text-white/70">
              Create a draft session to see your team here.
            </p>
            <Link
              to="/draft"
              className="mt-4 inline-block rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-black text-black transition hover:bg-emerald-400"
            >
              Go to Draft
            </Link>
          </section>
        </FadeIn>
      )}

      {/* Sessions exist but no current active draft (e.g. right after New/Discard) */}
      {noActiveDraft && (
        <FadeIn delayMs={60}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-lg font-black text-white">No active draft</h2>
            <p className="mt-2 text-sm font-semibold text-white/70">
              Start or load a draft session, and your team will appear here.
            </p>
            <Link
              to="/draft"
              className="mt-4 inline-block rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-black text-black transition hover:bg-emerald-400"
            >
              Go to Draft
            </Link>
          </section>
        </FadeIn>
      )}

      {/* The session list fetch itself failed */}
      {sessionsError && (
        <FadeIn delayMs={60}>
          <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-200">
            Failed to load draft sessions: {sessionsError}
          </section>
        </FadeIn>
      )}

      {/* Main body: search / sort / position filter + player list table */}
      {!noSessions && !noActiveDraft && !sessionsError && (
      <FadeIn delayMs={60} className="relative z-40">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          {/* Search box + sort dropdown */}
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
                options={SORT_OPTIONS}
                onChange={setSort}
              />
            </div>
          </div>

          {/* Position filter chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {POSITION_FILTERS.map((position) => (
              <button
                key={position}
                onClick={() => setPos(position)}
                className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                  pos === position
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {position}
              </button>
            ))}
          </div>

          {/* Player list table */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            {/* Table header */}
            <div className={`grid ${TABLE_GRID_COLS} bg-black/40 px-4 py-3 text-xs font-extrabold text-white/60`}>
              <div>Player</div>
              <div>Pos</div>
              <div>$</div>
              <div>Team</div>
              <div>AVG/ERA</div>
              <div>HR/SO</div>
              <div>RBI/W</div>
              <div>SB/SV</div>
              <div className="text-right">PPA-DUN Value</div>
            </div>

            {/* Table body: four branches — loading / error / empty / normal */}
            <div className="bg-black/20">
              {(sessionsLoading || loading) && (
                <div className="p-4">
                  <Skeleton className="h-24" />
                </div>
              )}

              {!sessionsLoading && !loading && error && (
                <div className="p-4 text-sm text-red-200">Failed to load my team: {error}</div>
              )}

              {!sessionsLoading && !loading && !error && visiblePlayers.length === 0 && (
                <div className="p-4 text-sm text-white/70">No players found.</div>
              )}

              {!sessionsLoading && !loading && !error && visiblePlayers.map((player) => (
                <div
                  key={player.id}
                  className={`grid w-full ${TABLE_GRID_COLS} items-center px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/5`}
                >
                  {/* Player name (opens modal on click) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfilePlayerId(Number(player.id));
                        setProfilePlayerType(player.playerType);
                      }}
                      className="rounded-md border border-transparent px-2 py-1 -mx-2 -my-1 font-semibold text-white transition hover:border-white/35 hover:bg-white/5 hover:text-amber-200 focus-visible:border-white/45 focus-visible:bg-white/10 focus-visible:outline-none"
                    >
                      {player.name}
                    </button>
                  </div>

                  {/* Position badge */}
                  <div>
                    <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white/80">
                      {player.pos}
                    </span>
                  </div>

                  {/* Draft cost */}
                  <div className="font-semibold text-white/80">{player.cost}</div>

                  {/* MLB team badge (color per team) */}
                  <div>
                    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-extrabold ${mlbTeamBadgeClass(player.team)}`}>
                      {player.team}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="text-white/70">
                    {isPitcher(player) ? formatNumber(player.era, 2) : formatAvg(player.avg)}
                  </div>
                  <div className="font-semibold text-amber-300">
                    {isPitcher(player) ? player.so ?? "-" : player.hr ?? "-"}
                  </div>
                  <div className="text-white/70">
                    {isPitcher(player) ? player.w ?? "-" : player.rbi ?? "-"}
                  </div>
                  <div className="font-semibold text-amber-300">
                    {isPitcher(player) ? player.sv ?? "-" : player.sb ?? "-"}
                  </div>

                  {/* PPA-DUN value score (glow effect when 10 or above) */}
                  <div className={`text-right text-sm font-black ${ppaValueClass(player.ppaValue)}`}>
                    {formatPpa(player.ppaValue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>
      )}

      {/* Player info modal */}
      <PlayerInfoModal
        open={profilePlayerId !== null}
        playerId={profilePlayerId}
        playerType={profilePlayerType}
        onClose={() => setProfilePlayerId(null)}
      />
    </div>
  );
}
