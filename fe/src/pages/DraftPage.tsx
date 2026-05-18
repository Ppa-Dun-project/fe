// Draft Room — the main feature page.
// Displays: draft board (team rosters), player list with search/filter/sort,
// player comparison panel, Add/Taken bid modals, and player info modal.
//
// Option A data flow:
//   1. Mount branching:
//      - useParams.sessionId present → GET /api/draft/sessions/{id} → React state
//      - No sessionId → sessionStorage["ppadun_unsaved_draft"] → React state
//      - Neither → redirect home
//   2. Public GET /api/draft/players → player list (no values)
//   3. POST /api/draft/players/values, body { config, picks } → values to merge in
//   4. Adding/removing picks only updates React state. In unsaved mode, sessionStorage is also synced.
//   5. The Save button is the sole server commit point (POST or PUT /api/draft/sessions[/id]).
//
// Filtering, sorting, and pagination all run client-side on the merged list.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FadeIn from "../components/ui/FadeIn";
import { useAuth } from "../lib/auth";
import { apiGet, apiGetAuth, apiPostAuth, apiPutAuth, apiDeleteAuth } from "../lib/api";

import type {
  ContractCode,
  DraftConfigServer,
  DraftPick,
  DraftPickKind,
  DraftPlayer,
  DraftPlayerBid,
  DraftPlayerPublic,
  DraftPlayerValue,
  DraftPositionFilter,
  DraftSort,
  DraftTeam,
  SessionDetail,
  SessionSummary,
} from "../types/draft";
type DraftPosition = DraftPlayer["positions"][number];

import {
  DEFAULT_ROSTER_SLOTS,
  MINOR_TAXI_SLOT_COUNT,
  buildSlotTemplateFromCounts,
  calculateCurrentRound,
  calculateRemainingBudget,
  clampRosterSize,
  findEligibleSlotIndex,
  findFirstEmptySlot,
  isEligibleForSlot,
} from "../features/draft/utils";
import {
  buildSortOptions,
  DEFAULT_DRAFT_CONFIG,
  DEFAULT_POSITION_FILTERS,
  UNSAVED_DRAFT_KEY,
  arePlayersComparable,
  buildTeamsFromConfig,
  initialNameFor,
  isPitcherPositionFilter,
  matchesPositionFilter,
  mergePlayersWithValues,
  removeUnsavedDraftStorage,
  setActiveDraftSessionId,
  type DraftPlayersResponse,
  type DraftPlayerValuesResponse,
  type SessionsListResponse,
  type UnsavedDraft,
} from "../features/draft/draftHelpers";

import DraftRoomBoard from "../features/draft/components/DraftRoomBoard";
import AddBidModal from "../features/draft/components/AddBidModal";
import TakenBidModal from "../features/draft/components/TakenBidModal";
import PlayerComparisonModal from "../features/draft/components/PlayerComparisonModal";
import PlayerNotePopover from "../features/draft/components/PlayerNotePopover";
import StatPickerStrip from "../features/draft/components/StatPickerStrip";
import SaveSessionModal from "../features/draft/components/SaveSessionModal";
import RenameSessionModal from "../features/draft/components/RenameSessionModal";
import NewDraftConfirmModal from "../features/draft/components/NewDraftConfirmModal";
import ImportSessionsModal from "../features/draft/components/ImportSessionsModal";
import CopySessionModal from "../features/draft/components/CopySessionModal";
import PlayerListTable from "../features/draft/components/PlayerListTable";
import DraftHeaderBar from "../features/draft/components/DraftHeaderBar";
import PlayerSearchToolbar from "../features/draft/components/PlayerSearchToolbar";
import OrderedDraftHistoryModal from "../features/draft/components/OrderedDraftHistoryModal";
import ComparisonPanel from "../features/draft/components/ComparisonPanel";
import { useStatColumns } from "../features/draft/useStatColumns";
import { getStatDef } from "../features/draft/statColumns";
import { useDraftSessionLoader } from "../features/draft/useDraftSessionLoader";
import { useNotificationPolling } from "../hooks/useNotificationPolling";
import type { NotificationEvent } from "../types/notifications";
import PlayerInfoModal from "../features/players/components/PlayerInfoModal";
import Modal from "../components/ui/Modal";
import Toast, { type ToastMessage, type ToastVariant } from "../components/ui/Toast";
import { useUndoStack } from "../hooks/useUndoStack";
import { useUndoKeyboardShortcuts } from "../hooks/useUndoKeyboardShortcuts";
import DraftSetupCard, { type DraftSetupConfig } from "../features/home/DraftSetupCard";
import LoginPromptModal from "../features/auth/LoginPromptModal";

const PAGE_SIZE = 30;

// Maps notification event_type → toast prefix + variant.
// Unknown types fall back to a generic notification.
function notificationDisplay(eventType: string): {
  prefix: string;
  variant: ToastVariant;
} {
  switch (eventType) {
    case "INJURY":
      return { prefix: "🏥 INJURY UPDATE", variant: "injury" };
    case "DEPTH":
      return { prefix: "📊 DEPTH CHART UPDATE", variant: "depth" };
    case "NEWS":
      return { prefix: "📰 MLB NEWS", variant: "info" };
    default:
      return { prefix: "🔔 NOTIFICATION", variant: "info" };
  }
}

// Pure helpers, constants, and inline response/payload types live in
// `draftHelpers.ts` so this file stays focused on orchestration. See that
// module for: matchesPositionFilter, isPitcherOnly, isPitcherPositionFilter,
// formatNumber, formatDraftStatSummary, sort-value accessors,
// buildTeamsFromConfig, normalizeDraftPicks, mergePlayersWithValues,
// readUnsavedDraftStorage / removeUnsavedDraftStorage, DEFAULT_DRAFT_CONFIG,
// DEFAULT_POSITION_FILTERS, BATTER_/PITCHER_SORT_OPTIONS, etc.

export default function DraftPage() {
  const authed = useAuth();
  const navigate = useNavigate();
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = sessionIdParam ? Number(sessionIdParam) : null;
  const isLoadedMode = sessionId !== null && Number.isFinite(sessionId);

  const [searchParams] = useSearchParams();
  const draftRoomTopRef = useRef<HTMLDivElement | null>(null); // Scroll target after draft pick

  // Setup / login-prompt modal that the "Start Your Draft" button opens.
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  // Right after Start Draft, cover the whole page with a blur while waiting for the first PPA-values response.
  // Subsequent recomputations triggered by pick changes refresh in the background without an overlay.
  const [pendingStartDraft, setPendingStartDraft] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Flag used by the "New" → "Save first?" Yes path to automatically open
  // the setup modal once Save finishes. Cleared when the Save modal is cancelled.
  const [postSaveAction, setPostSaveAction] = useState<"setup" | null>(null);

  // The three-button confirmation modal shown on "New" click — used in unsaved state only.
  const [newConfirmOpen, setNewConfirmOpen] = useState(false);

  // Toast queue. Ids are assigned via a monotonic counter.
  const toastIdRef = useRef(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pushToast = (
    text: string,
    variant: ToastVariant = "info",
    durationMs?: number,
  ) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, variant, durationMs }]);
  };
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Core draft state — populated once on mount, after which every pick change only updates React state.
  const [config, setConfig] = useState<DraftConfigServer | null>(null);
  const [hasDraftConfig, setHasDraftConfig] = useState(false);
  const [teams, setTeams] = useState<DraftTeam[]>([]);
  // picks is managed by useUndoStack to support undo / redo.
  //   - commitPicks: user-initiated changes (add/remove/slot move) → pushed onto history
  //   - resetPicks:  changes that should break history (session switch, new draft start, etc.)
  const {
    state: picks,
    commit: commitPicks,
    reset: resetPicks,
    undo: undoPicks,
    redo: redoPicks,
    canUndo: canUndoPicks,
    canRedo: canRedoPicks,
  } = useUndoStack<DraftPick[]>([]);

  // Keyboard shortcuts — Ctrl/Cmd+Z = undo, Ctrl+Y / Ctrl·Cmd+Shift+Z = redo.
  // Ignored inside input / textarea / contenteditable (preserves the browser's native undo).
  useUndoKeyboardShortcuts({
    onUndo: undoPicks,
    onRedo: redoPicks,
    canUndo: canUndoPicks,
    canRedo: canRedoPicks,
  });
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Base list fetched from the public API (no values attached)
  const [publicPlayers, setPublicPlayers] = useState<DraftPlayerPublic[]>([]);
  // Values table fetched from the authenticated API — null when logged out or fetch fails
  const [playerValues, setPlayerValues] = useState<DraftPlayerValue[] | null>(null);

  const [query, setQuery] = useState(() => searchParams.get("query")?.trim() ?? "");
  const [position, setPosition] = useState<DraftPositionFilter>("C");
  const [sort, setSort] = useState<DraftSort>("score_desc");
  const [page, setPage] = useState(1);

  // Filter/sort options are no longer returned by the server — derived locally.
  const positionFilters = DEFAULT_POSITION_FILTERS;
  const showingPitcherColumns = isPitcherPositionFilter(position);

  // The user-selected 5 stat columns (separately for batters/pitchers) — persisted in localStorage.
  const { batterCols, pitcherCols, setBatterCols, setPitcherCols, resetToDefaults: resetStatColumns } = useStatColumns();
  const activeStatKeys = showingPitcherColumns ? pitcherCols : batterCols;
  // If a slot is null, the header label is an empty string too — so neighboring columns don't shift.
  const statColumnLabels = activeStatKeys.map((k) => (k ? getStatDef(k)?.label ?? k : ""));

  // Sort dropdown options track the currently selected stat columns — "By Score" + one entry per filled slot.
  const sortOptions = useMemo(() => buildSortOptions(activeStatKeys), [activeStatKeys]);

  // If the current sort key drops out of the available options (e.g. user removed that
  // stat from the strip, or switched between batter/pitcher groups), fall back to "score_desc".
  useEffect(() => {
    if (!sortOptions.some((opt) => opt.value === sort)) {
      setSort("score_desc");
    }
  }, [sortOptions, sort]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player comparison state
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);
  const [profilePlayerType, setProfilePlayerType] = useState<"batter" | "pitcher">("batter");

  // Indicator while a player note is being saved — used to disable / show loading on the modal's Save button.
  const [noteSaving, setNoteSaving] = useState(false);

  // The board currently being viewed — main/minors/taxi. Switched via the post-it tabs on DraftRoomBoard.
  // Add/Taken actions create picks with this view's kind.
  const [boardView, setBoardView] = useState<DraftPickKind>("main");

  const [addTarget, setAddTarget] = useState<DraftPlayer | null>(null);
  // Recommended bid that's fetched on-the-fly when the Add modal opens, plus its in-flight state.
  const [addTargetBid, setAddTargetBid] = useState<number | null>(null);
  const [addTargetBidLoading, setAddTargetBidLoading] = useState(false);
  const [takenTarget, setTakenTarget] = useState<DraftPlayer | null>(null);

  // Notes — playerId → note. Fetch/save only happens in loaded mode (requires a session ID).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteTarget, setNoteTarget] = useState<DraftPlayer | null>(null);
  // Polls the backend for notifications every 15 seconds. One toast per new event in a cycle (each shown for 10 seconds).
  // - 10 or fewer: fire them all at once
  // - 11 or more: stagger at 2-second intervals so they don't bury the screen all at once.
  //   Deliberately no setTimeout cleanup — on DraftPage unmount pushToast becomes a stale
  //   closure, but React ignores setState on unmounted components, so it's safe.
  useNotificationPolling((evs: NotificationEvent[]) => {
    if (evs.length === 0) return;

    const STAGGER_THRESHOLD = 10;
    const STAGGER_MS = 2000;

    const showOne = (ev: NotificationEvent) => {
      const { prefix, variant } = notificationDisplay(ev.event_type);
      pushToast(`${prefix} — ${ev.message}`, variant);
    };

    if (evs.length <= STAGGER_THRESHOLD) {
      for (const ev of evs) showOne(ev);
      return;
    }

    evs.forEach((ev, i) => {
      window.setTimeout(() => showOne(ev), i * STAGGER_MS);
    });
  }, authed);

  // Save / Import modals
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Rename modal — only for renaming a loaded session.
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const rosterSize = useMemo(
    () => clampRosterSize(config?.rosterPlayers),
    [config?.rosterPlayers]
  );
  // Legacy sessions may lack rosterSlots, so fall back to the default.
  const rosterSlotCounts = useMemo(
    () => config?.rosterSlots ?? DEFAULT_ROSTER_SLOTS,
    [config?.rosterSlots]
  );
  const slotTemplate = useMemo(
    () => buildSlotTemplateFromCounts(rosterSlotCounts),
    [rosterSlotCounts]
  );

  // Final UI list — merges the public player list with the authenticated value list by playerId
  const allPlayers = useMemo<DraftPlayer[]>(
    () => mergePlayersWithValues(publicPlayers, playerValues),
    [publicPlayers, playerValues]
  );

  // Client-side filter + sort + paginate (server returns full list).
  const filteredPlayers = useMemo(() => {
    let result = allPlayers;

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }

    result = result.filter((p) => matchesPositionFilter(p.positions, position));

    const sorted = [...result].sort((a, b) => {
      // Dynamic stat sort — `stat:KEY` uses the StatDef accessor for whichever
      // column the user picked. lowerIsBetter (ERA / WHIP / etc.) flips direction.
      if (typeof sort === "string" && sort.startsWith("stat:")) {
        const key = sort.slice(5);
        const def = getStatDef(key);
        if (def) {
          const av = def.accessor(a) ?? 0;
          const bv = def.accessor(b) ?? 0;
          return def.lowerIsBetter ? av - bv : bv - av;
        }
      }
      // Fallback / "score_desc" — PPA-DUN value, highest first.
      return (b.ppaValue ?? 0) - (a.ppaValue ?? 0);
    });

    return sorted;
  }, [allPlayers, query, position, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));

  // Clamp page if filter reduces totalPages below current page (setState during render)
  if (page > totalPages) {
    setPage(1);
  }

  const players = useMemo(
    () => filteredPlayers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredPlayers, page]
  );

  // Quick lookup: playerId → DraftPlayer object.
  const playersById = useMemo<Record<string, DraftPlayer>>(
    () => Object.fromEntries(allPlayers.map((player) => [player.id, player])),
    [allPlayers]
  );

  const myTeam = teams.find((team) => team.isMine) ?? teams[0] ?? null;

  // Calculate remaining budget for each team based on their picks.
  const remainingBudgetByTeam = useMemo(() => {
    const spentByTeam = new Map<string, number>();
    for (const pick of picks) {
      if (typeof pick.bid !== "number") continue;
      spentByTeam.set(pick.draftedByTeamId, (spentByTeam.get(pick.draftedByTeamId) ?? 0) + pick.bid);
    }
    const budget = config?.budget ?? 0;
    return Object.fromEntries(
      teams.map((team) => [
        team.id,
        Math.max(0, budget - (spentByTeam.get(team.id) ?? 0)),
      ])
    ) as Record<string, number>;
  }, [teams, picks, config?.budget]);

  const remainingBudget = useMemo(() => {
    const budget = config?.budget ?? 0;
    if (!myTeam) return budget;
    return remainingBudgetByTeam[myTeam.id] ?? calculateRemainingBudget(budget, myTeam.id, picks);
  }, [config?.budget, myTeam, picks, remainingBudgetByTeam]);

  const currentRound = useMemo(() => {
    if (teams.length === 0) return 1;
    return calculateCurrentRound(teams.length, rosterSize, picks);
  }, [teams.length, rosterSize, picks]);

  // Changing the position filter can drop the player from the paginated `players`, so we look up against the full list.
  const selectedA = compareAId ? playersById[compareAId] ?? null : null;
  const selectedB = compareBId ? playersById[compareBId] ?? null : null;

  // The compare slots / modal / AI all need recommendedBid — prefetch it with a single-player call as soon as a player is selected.
  // The call is not repeated if the same player is re-selected; A/B clearing resets it to null immediately.
  const [compareBidA, setCompareBidA] = useState<number | null>(null);
  const [compareBidB, setCompareBidB] = useState<number | null>(null);

  const openAddModal = (player: DraftPlayer) => {
    setAddTarget(player);
  };

  const openTakenModal = (player: DraftPlayer) => {
    setTakenTarget(player);
  };

  const closeAddModal = () => {
    setAddTarget(null);
    setAddTargetBid(null);
    setAddTargetBidLoading(false);
  };

  const closeTakenModal = () => {
    setTakenTarget(null);
  };

  // Notes popover — only usable in a loaded session (in unsaved mode the button itself is disabled).
  const openNoteModal = (player: DraftPlayer) => {
    setNoteTarget(player);
  };

  const closeNoteModal = () => {
    if (noteSaving) return;
    setNoteTarget(null);
  };

  const handleNoteSave = (note: string) => {
    if (!noteTarget) return;
    const playerId = noteTarget.id;
    const trimmed = note.trim();

    const applyLocal = () =>
      setNotes((prev) => {
        const next = { ...prev };
        if (trimmed) next[playerId] = trimmed;
        else delete next[playerId];
        return next;
      });

    // Unsaved mode — the sessionStorage-sync effect picks it up automatically, so just update state here.
    if (sessionId === null) {
      applyLocal();
      setNoteTarget(null);
      return;
    }

    // Saved session — PUT to the server immediately.
    setNoteSaving(true);
    apiPutAuth<{ status: string }, { note: string }>(
      `/api/draft/sessions/${sessionId}/notes/${encodeURIComponent(playerId)}`,
      { note: trimmed }
    )
      .then(() => {
        applyLocal();
        setNoteTarget(null);
      })
      .catch((err: unknown) => {
        console.error(err);
        pushToast("Failed to save note", "error");
      })
      .finally(() => setNoteSaving(false));
  };

  // Updates page state from the config entered in the Start Your Draft modal.
  // Also writes to sessionStorage so the draft resumes after navigation/refresh in the same tab.
  const handleSetupSubmit = (next: DraftSetupConfig) => {
    const config: DraftConfigServer = {
      leagueType: next.leagueType,
      budget: next.budget,
      rosterPlayers: next.rosterPlayers,
      myTeamName: next.myTeamName,
      opponentsCount: next.opponentsCount,
      oppTeamNames: next.oppTeamNames,
      rosterSlots: next.rosterSlots,
      targetSeason: next.targetSeason,
    };
    try {
      sessionStorage.setItem(
        UNSAVED_DRAFT_KEY,
        JSON.stringify({ config, picks: [], notes: {} } satisfies UnsavedDraft)
      );
    } catch {
      // Silently ignore quota-exceeded and similar errors.
    }
    setConfig(config);
    setTeams(buildTeamsFromConfig(config));
    resetPicks([]);
    setNotes({});
    setHasDraftConfig(true);
    setSetupModalOpen(false);
    // The next useEffect refetches PPA values with the new config — the overlay stays up until that completes.
    setPendingStartDraft(true);
  };

  // Logged out → login modal; logged in → setup modal.
  const openStartDraft = () => {
    if (authed) {
      setSetupModalOpen(true);
    } else {
      setLoginModalOpen(true);
    }
  };

  // Reset all local state / sessionStorage back to a "fresh entry" state, then
  // open the setup modal. If we were in loaded mode, also change the URL to /draft to block side effects.
  const resetToFreshSetup = () => {
    try {
      removeUnsavedDraftStorage();
    } catch {
      // ignore
    }
    if (isLoadedMode) {
      navigate("/draft", { replace: true });
    }
    setConfig(DEFAULT_DRAFT_CONFIG);
    setTeams(buildTeamsFromConfig(DEFAULT_DRAFT_CONFIG));
    resetPicks([]);
    setNotes({});
    setHasDraftConfig(false);
    setSessionName(null);
    setSetupModalOpen(true);
  };

  // New button — clean up the current draft and open the setup modal to start fresh.
  //   - Loaded session (isLoadedMode): already persisted in the DB, so jump straight into setup.
  //   - Unsaved draft: branch into a three-button confirm modal (Save first / Discard current / Cancel).
  //     Cancel is a true abort — no draft state changes.
  const handleNewDraft = () => {
    if (isLoadedMode) {
      resetToFreshSetup();
      return;
    }
    setNewConfirmOpen(true);
  };

  const handleNewConfirmSaveFirst = () => {
    setNewConfirmOpen(false);
    setPostSaveAction("setup");
    openSaveModal();
  };

  const handleNewConfirmDiscard = () => {
    setNewConfirmOpen(false);
    resetToFreshSetup();
  };

  const handleNewConfirmCancel = () => {
    // True cancel — leave all state untouched.
    setNewConfirmOpen(false);
  };

  // Discard the in-progress unsaved draft — clears sessionStorage and returns to the player-browser state.
  // For saved sessions (isLoadedMode) this button isn't shown, so no branching needed.
  const handleDiscardDraft = () => {
    if (!window.confirm("Discard the current draft? This cannot be undone.")) return;

    if (isLoadedMode && sessionId !== null && config !== null) {
      const loadedConfig = config;
      apiPutAuth<SessionDetail, { name: string; picks: DraftPick[] }>(
        `/api/draft/sessions/${sessionId}`,
        { name: sessionName ?? "Draft Room", picks: [] }
      )
        .then(() => {
          resetPicks([]);
          setTeams(buildTeamsFromConfig(loadedConfig));
        })
        .catch((err: unknown) => {
          console.error("Failed to discard picks:", err);
          window.alert("Failed to discard picks. Please try again.");
        });
      return;
    }

    try {
      removeUnsavedDraftStorage();
    } catch {
      // ignore
    }
    setConfig(DEFAULT_DRAFT_CONFIG);
    setTeams(buildTeamsFromConfig(DEFAULT_DRAFT_CONFIG));
    resetPicks([]);
    setNotes({});
    setHasDraftConfig(false);
  };

  // Session bootstrap + notes fetch — delegated to a hook that encapsulates both useEffects.
  // The behavior is identical: loaded mode does GET session detail + notes; unsaved mode
  // resumes from sessionStorage or falls back to DEFAULT_DRAFT_CONFIG.
  useDraftSessionLoader({
    isLoadedMode,
    sessionId,
    setConfig,
    setHasDraftConfig,
    setTeams,
    setSessionName,
    setBootstrapped,
    setNotes,
    resetPicks,
  });

  // Mirror the "currently active draft session" into sessionStorage so the My Team page can see it.
  // Loaded mode → that sessionId; unsaved (or fresh) → null.
  // → Prevents My Team from showing the wrong session because of a stale URL ?sessionId.
  useEffect(() => {
    if (isLoadedMode && sessionId !== null) {
      setActiveDraftSessionId(sessionId);
    } else {
      setActiveDraftSessionId(null);
    }
  }, [isLoadedMode, sessionId]);

  // In unsaved mode, sync picks/notes to sessionStorage whenever they change — protects against navigation/refresh.
  useEffect(() => {
    if (isLoadedMode || !bootstrapped || !config || !hasDraftConfig) return;
    try {
      sessionStorage.setItem(
        UNSAVED_DRAFT_KEY,
        JSON.stringify({ config, picks, notes } satisfies UnsavedDraft)
      );
    } catch {
      // Silently ignore quota-exceeded and similar errors — losing refresh protection doesn't affect on-screen behavior.
    }
  }, [isLoadedMode, bootstrapped, config, hasDraftConfig, picks, notes]);

  // Public player list — refetched when leagueType changes.
  // AL/NL filter on the backend via ?league=, everything else (custom, etc.) returns the full list.
  const leagueQuery =
    config?.leagueType === "AL" || config?.leagueType === "NL"
      ? config.leagueType
      : null;
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    const path = leagueQuery
      ? `/api/draft/players?league=${leagueQuery}`
      : "/api/draft/players";

    apiGet<DraftPlayersResponse>(path, undefined, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setPublicPlayers(data.items ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setPublicPlayers([]);
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [leagueQuery]);

  // Fetch PPA values only for authenticated users and merge them into the public list by playerId.
  // recommendedBid is fetched per-player when the Add modal opens (POST /api/draft/players/bid).
  // On logout, values are cleared immediately so they don't linger in the UI.
  useEffect(() => {
    if (!authed || !config) {
      queueMicrotask(() => setPlayerValues(null));
      return;
    }

    const controller = new AbortController();

    apiGetAuth<DraftPlayerValuesResponse>(
      "/api/draft/players/value",
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setPlayerValues(data.items ?? []);
        setPendingStartDraft(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setPlayerValues(null);
        setPendingStartDraft(false);
        pushToast("Failed to load player values. Please try again.", "error");
      });

    return () => controller.abort();
  }, [authed, config]);

  // Each time Compare A changes, fire a single-player bid call — shared by the Compare slots / modal / AI.
  // Reset in a microtask the instant the selection changes so the old bid isn't mistakenly applied to the new player.
  // picks is included in the fetch payload but omitted from deps — refetching on every pick would be expensive.
  useEffect(() => {
    if (!authed || !config || !compareAId) {
      queueMicrotask(() => setCompareBidA(null));
      return;
    }
    queueMicrotask(() => setCompareBidA(null));
    const controller = new AbortController();
    apiPostAuth<DraftPlayerBid, { playerId: string; config: DraftConfigServer; picks: DraftPick[] }>(
      "/api/draft/players/bid",
      { playerId: compareAId, config, picks },
      undefined,
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        setCompareBidA(res.recommendedBid);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setCompareBidA(null);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, config, compareAId]);

  useEffect(() => {
    if (!authed || !config || !compareBId) {
      queueMicrotask(() => setCompareBidB(null));
      return;
    }
    queueMicrotask(() => setCompareBidB(null));
    const controller = new AbortController();
    apiPostAuth<DraftPlayerBid, { playerId: string; config: DraftConfigServer; picks: DraftPick[] }>(
      "/api/draft/players/bid",
      { playerId: compareBId, config, picks },
      undefined,
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        setCompareBidB(res.recommendedBid);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setCompareBidB(null);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, config, compareBId]);

  // Player object with the bid filled in — ComparisonPanel / PlayerComparisonModal / AI recommendation all share this object.
  const selectedAWithBid = useMemo(
    () => (selectedA ? { ...selectedA, recommendedBid: compareBidA } : null),
    [selectedA, compareBidA],
  );
  const selectedBWithBid = useMemo(
    () => (selectedB ? { ...selectedB, recommendedBid: compareBidB } : null),
    [selectedB, compareBidB],
  );

  // Toggle player selection for A/B comparison (max 2 players).
  // Block mixed batter/pitcher comparisons and surface a toast.
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

    const candidate = playersById[playerId];
    if (!candidate) return;
    const counterpart = !compareAId
      ? selectedB
      : !compareBId
        ? selectedA
        : selectedA; // If both slots are filled, B gets replaced → it must be comparable with A

    if (counterpart && !arePlayersComparable(candidate, counterpart)) {
      pushToast("Batters and pitchers cannot be compared together.", "error");
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

  const openPlayerInfo = (rawPlayerId: string, playerType: "batter" | "pitcher" | "two_way") => {
    const parsed = Number(rawPlayerId);
    if (!Number.isFinite(parsed)) {
      setError("Invalid player id");
      return;
    }
    setProfilePlayerId(parsed);
    setProfilePlayerType(playerType === "pitcher" ? "pitcher" : "batter");
  };

  const closePlayerInfo = () => {
    setProfilePlayerId(null);
  };

  // Remove a pick — no server call, only React state updates. localStorage sync in unsaved mode is handled in a separate effect.
  const handleRemovePick = (pick: DraftPick) => {
    commitPicks((prev) => prev.filter((p) => p.playerId !== pick.playerId));
  };

  // When drag-and-drop moves a slot/team:
  //  - Same team: main requires eligibility check before moving/swapping; minors/taxi are pure reordering.
  //  - Different team: only allowed on an empty slot + eligibility (main). If occupied, show a toast instead of swapping.
  const handleSlotReassign = (
    fromTeamId: string,
    fromIndex: number,
    toTeamId: string,
    toIndex: number,
    kind: DraftPickKind,
  ) => {
    if (fromTeamId === toTeamId && fromIndex === toIndex) return;

    const fromTeamPicks = picks.filter(
      (p) => p.draftedByTeamId === fromTeamId && p.kind === kind
    );
    const fromPick = fromTeamPicks.find((p) => p.slotIndex === fromIndex);
    if (!fromPick) return;

    const toTeamPicks = picks.filter(
      (p) => p.draftedByTeamId === toTeamId && p.kind === kind
    );
    const toPick = toTeamPicks.find((p) => p.slotIndex === toIndex);
    const isCrossTeam = fromTeamId !== toTeamId;

    // Cross-team move: don't swap if occupied — show a toast instead.
    if (isCrossTeam && toPick) {
      const targetTeam = teams.find((t) => t.id === toTeamId);
      pushToast(
        `${targetTeam?.name ?? "Target team"} already has a player in that slot.`,
        "error",
      );
      return;
    }

    // Minors/taxi: handle without an eligibility check.
    if (kind !== "main") {
      commitPicks((prev) =>
        prev.map((p) => {
          if (p.kind !== kind) return p;
          if (p.playerId === fromPick.playerId) {
            return { ...p, slotIndex: toIndex, draftedByTeamId: toTeamId };
          }
          if (toPick && p.playerId === toPick.playerId) {
            return { ...p, slotIndex: fromIndex };
          }
          return p;
        })
      );
      return;
    }

    const fromSlotPos = slotTemplate[fromIndex];
    const toSlotPos = slotTemplate[toIndex];
    if (!fromSlotPos || !toSlotPos) return;

    const fromPlayer = playersById[fromPick.playerId];
    if (!fromPlayer) return;

    if (!isEligibleForSlot(fromPlayer.positions, toSlotPos)) {
      pushToast(`${fromPlayer.name} is not eligible for ${toSlotPos}.`, "error");
      return;
    }

    // Cross-team move (empty-slot check already done above): swap teamId + slotIndex + slotPos.
    if (isCrossTeam) {
      commitPicks((prev) =>
        prev.map((p) =>
          p.playerId === fromPick.playerId
            ? {
                ...p,
                slotIndex: toIndex,
                slotPos: toSlotPos as DraftPosition,
                draftedByTeamId: toTeamId,
              }
            : p
        )
      );
      return;
    }

    // Same team — empty target → simple move.
    if (!toPick) {
      commitPicks((prev) =>
        prev.map((p) =>
          p.playerId === fromPick.playerId
            ? { ...p, slotIndex: toIndex, slotPos: toSlotPos as DraftPosition }
            : p
        )
      );
      return;
    }

    // Same team — occupied target → swap only when both directions are eligible.
    const toPlayer = playersById[toPick.playerId];
    if (!toPlayer) return;
    if (!isEligibleForSlot(toPlayer.positions, fromSlotPos)) {
      pushToast(
        `Can't swap: ${toPlayer.name} is not eligible for ${fromSlotPos}.`,
        "error"
      );
      return;
    }
    commitPicks((prev) =>
      prev.map((p) => {
        if (p.playerId === fromPick.playerId) {
          return { ...p, slotIndex: toIndex, slotPos: toSlotPos as DraftPosition };
        }
        if (p.playerId === toPick.playerId) {
          return { ...p, slotIndex: fromIndex, slotPos: fromSlotPos as DraftPosition };
        }
        return p;
      })
    );
  };

  // When adding a pick, the client decides slotIndex immediately.
  // Drop any existing pick with the same playerId → build the set of occupied slots for the same team+kind → find an empty slot.
  // Main uses positional eligibility; minors/taxi just take the first empty slot.
  // -1 means no spot is available — notify and bail.
  const addPickToState = (
    playerId: string,
    draftedByTeamId: string,
    bid: number | null,
    type: DraftPick["type"],
    kind: DraftPickKind,
    contractCode: ContractCode | null = null,
  ) => {
    const filtered = picks.filter((p) => p.playerId !== playerId);
    const occupied = new Set(
      filtered
        .filter((p) => p.draftedByTeamId === draftedByTeamId && p.kind === kind)
        .map((p) => p.slotIndex)
    );
    const player = playersById[playerId];

    // signedSeason is pinned to the current session's targetSeason (the anchor for rollover).
    // Without a contractCode, signedSeason is meaningless, so null it out too.
    const signedSeason = contractCode ? config?.targetSeason ?? null : null;

    if (kind !== "main") {
      const slotIndex = findFirstEmptySlot(occupied, MINOR_TAXI_SLOT_COUNT);
      if (slotIndex === -1) {
        pushToast(
          `No empty ${kind} slot for ${player?.name ?? "this player"}.`,
          "error"
        );
        return false;
      }
      const next: DraftPick = {
        playerId,
        draftedByTeamId,
        slotIndex,
        slotPos: null,
        bid: null,
        type,
        kind,
        contractCode: null,
        signedSeason: null,
      };
      commitPicks([...filtered, next]);
      return true;
    }

    const slotIndex = findEligibleSlotIndex(
      player?.positions,
      slotTemplate,
      occupied
    );
    if (slotIndex === -1) {
      pushToast(
        `No eligible roster slot for ${player?.name ?? "this player"}.`,
        "error"
      );
      return false;
    }

    const slotPos = (slotTemplate[slotIndex] ?? "BENCH") as DraftPosition;
    const next: DraftPick = {
      playerId,
      draftedByTeamId,
      slotIndex,
      slotPos,
      bid,
      type,
      kind: "main",
      contractCode,
      signedSeason,
    };
    commitPicks([...filtered, next]);
    return true;
  };

  // Add button click — main opens the bid modal (and fetches a single-player bid on open); minors/taxi add directly.
  const handleAddClick = (player: DraftPlayer) => {
    if (boardView !== "main") {
      if (!myTeam) return;
      if (addPickToState(player.id, myTeam.id, null, "mine", boardView)) {
        draftRoomTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (!config) return;
    openAddModal(player);
    setAddTargetBid(null);
    setAddTargetBidLoading(true);
    apiPostAuth<DraftPlayerBid, { playerId: string; config: DraftConfigServer; picks: DraftPick[] }>(
      "/api/draft/players/bid",
      { playerId: player.id, config, picks },
    )
      .then((res) => setAddTargetBid(res.recommendedBid))
      .catch((err: unknown) => {
        console.error(err);
        setAddTargetBid(null);
      })
      .finally(() => setAddTargetBidLoading(false));
  };

  const handleAddFinish = (bid: number, contractCode: ContractCode) => {
    if (!addTarget || !myTeam) return;
    if (!addPickToState(addTarget.id, myTeam.id, bid, "mine", "main", contractCode)) return;
    closeAddModal();
    draftRoomTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTakenFinish = (draftedByTeamId: string, bid: number | null) => {
    if (!takenTarget) return;
    if (!addPickToState(takenTarget.id, draftedByTeamId, bid, "taken", boardView)) return;
    closeTakenModal();
    draftRoomTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Save button handler ──
  const openSaveModal = () => {
    setSaveNameInput(initialNameFor(sessionName));
    setSaveError(null);
    setSaveModalOpen(true);
  };

  // Save button — for a loaded session, skip the name prompt and PUT immediately; toast on success.
  // Unsaved (new) mode keeps the existing flow and opens SaveSessionModal.
  const handleSaveClick = () => {
    if (!isLoadedMode || sessionId === null || !config || !sessionName) {
      openSaveModal();
      return;
    }
    setSaving(true);
    apiPutAuth<SessionDetail, { name: string; picks: DraftPick[] }>(
      `/api/draft/sessions/${sessionId}`,
      { name: sessionName, picks },
    )
      .then((data) => {
        setSessionName(data.name);
        pushToast("Session saved.", "success");
      })
      .catch((err: unknown) => {
        console.error(err);
        pushToast(
          err instanceof Error ? `Save failed: ${err.message}` : "Save failed.",
          "error",
        );
      })
      .finally(() => setSaving(false));
  };

  // Pencil icon → rename modal.
  const openRenameModal = () => {
    setRenameInput(sessionName ?? "");
    setRenameError(null);
    setRenameModalOpen(true);
  };

  const closeRenameModal = () => {
    if (renameSaving) return;
    setRenameModalOpen(false);
    setRenameError(null);
  };

  const handleRenameConfirm = () => {
    if (sessionId === null) return;
    const next = renameInput.trim();
    if (!next) {
      setRenameError("Name cannot be empty");
      return;
    }
    if (next === sessionName) {
      // No change — just close.
      setRenameModalOpen(false);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    apiPutAuth<SessionDetail, { name: string; picks: DraftPick[] }>(
      `/api/draft/sessions/${sessionId}`,
      { name: next, picks },
    )
      .then((data) => {
        setSessionName(data.name);
        setRenameModalOpen(false);
        pushToast("Session renamed.", "success");
      })
      .catch((err: unknown) => {
        console.error(err);
        setRenameError(err instanceof Error ? err.message : "Rename failed");
      })
      .finally(() => setRenameSaving(false));
  };

  // In a loaded session, picks changes trigger a 500ms-debounced background PUT.
  // Purpose: ensure MyTeam sees the latest picks when it queries the DB (real-time sync).
  // Skip the moment when bootstrap is setting picks on first mount / right after a session switch.
  const autoSaveTimerRef = useRef<number | null>(null);
  const skipFirstAutoSaveRef = useRef(true);

  useEffect(() => {
    skipFirstAutoSaveRef.current = true;
  }, [sessionId]);

  useEffect(() => {
    if (!isLoadedMode || sessionId === null || !config || !sessionName) return;
    if (skipFirstAutoSaveRef.current) {
      skipFirstAutoSaveRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      apiPutAuth<SessionDetail, { name: string; picks: DraftPick[] }>(
        `/api/draft/sessions/${sessionId}`,
        { name: sessionName, picks },
      ).catch((err: unknown) => {
        console.error("Auto-save failed:", err);
      });
      autoSaveTimerRef.current = null;
    }, 500);
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [picks, isLoadedMode, sessionId, sessionName, config]);

  const closeSaveModal = () => {
    setSaveModalOpen(false);
    setSaveError(null);
    // If the user cancels Save, also discard any chained post-save action.
    setPostSaveAction(null);
  };

  const handleSaveConfirm = () => {
    const name = saveNameInput.trim();
    if (!name) {
      setSaveError("Please enter a name");
      return;
    }
    if (!config) return;

    setSaving(true);
    setSaveError(null);

    if (isLoadedMode && sessionId !== null) {
      apiPutAuth<SessionDetail, { name: string; picks: DraftPick[] }>(
        `/api/draft/sessions/${sessionId}`,
        { name, picks }
      )
        .then((data) => {
          setSessionName(data.name);
          // closeSaveModal also clears postSaveAction, so capture any scheduled
          // chained action first, then close.
          const chained = postSaveAction;
          closeSaveModal();
          if (chained === "setup") {
            // Leave the saved session intact and move on to a fresh setup.
            resetToFreshSetup();
          }
        })
        .catch((err: unknown) => {
          console.error(err);
          setSaveError(err instanceof Error ? err.message : "Save failed");
        })
        .finally(() => setSaving(false));
      return;
    }

    apiPostAuth<SessionDetail, { name: string; config: DraftConfigServer; picks: DraftPick[] }>(
      "/api/draft/sessions",
      { name, config, picks }
    )
      .then(async (data) => {
        // Bulk-PUT any local notes accumulated during unsaved mode against the new session_id.
        // Individual failures are ignored — notes are auxiliary data and the session itself already saved successfully.
        const noteEntries = Object.entries(notes);
        if (noteEntries.length > 0) {
          await Promise.all(
            noteEntries.map(([playerId, note]) =>
              apiPutAuth<{ status: string }, { note: string }>(
                `/api/draft/sessions/${data.id}/notes/${encodeURIComponent(playerId)}`,
                { note }
              ).catch((err: unknown) => {
                console.error(`Failed to flush note for ${playerId}:`, err);
              })
            )
          );
        }

        try {
          removeUnsavedDraftStorage();
        } catch {
          // ignore
        }
        setSaving(false);
        setSaveModalOpen(false);

        if (postSaveAction === "setup") {
          // We came through the "New" → Yes-save flow — don't navigate to the newly
          // created session's URL; open a fresh setup modal directly. (The session
          // is already persisted in the DB and can be reopened later via Import.)
          setPostSaveAction(null);
          resetToFreshSetup();
        } else {
          navigate(`/draft/${data.id}`, { replace: true });
        }
      })
      .catch((err: unknown) => {
        setSaving(false);
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Maximum 3 sessions")) {
          alert("You can save up to 3 sessions. Please delete an existing session and try again.");
        } else {
          setSaveError(msg || "Save failed");
        }
      });
  };

  // ── Import modal handlers ──
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  // Copy flow: clicking the Copy button opens a rename modal; Confirm actually issues the POST.
  const [copyTarget, setCopyTarget] = useState<{ id: number } | null>(null);
  const [copyNameInput, setCopyNameInput] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copySaving, setCopySaving] = useState(false);

  const refreshSessionList = () => {
    setSessionListLoading(true);
    apiGetAuth<SessionsListResponse>("/api/draft/sessions")
      .then((data) => setSessionList(data.items ?? []))
      .catch((err: unknown) => {
        console.error(err);
        setSessionList([]);
      })
      .finally(() => setSessionListLoading(false));
  };

  const openImportModal = () => {
    setImportModalOpen(true);
    refreshSessionList();
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
  };

  const handleSessionPick = (id: number) => {
    closeImportModal();
    navigate(`/draft/${id}`);
  };

  // Copy button click: open the rename modal. The actual POST happens in handleCopyConfirm.
  const handleSessionCopy = (id: number) => {
    const source = sessionList.find((s) => s.id === id);
    setCopyTarget({ id });
    setCopyNameInput(source ? `${source.name} (Copy)` : "Copied Draft");
    setCopyError(null);
  };

  const closeCopyModal = () => {
    if (copySaving) return;
    setCopyTarget(null);
    setCopyNameInput("");
    setCopyError(null);
  };

  // Confirm: load the source session + notes → POST a new session under the user-entered name.
  const handleCopyConfirm = () => {
    if (copyTarget === null) return;
    const name = copyNameInput.trim();
    if (!name) {
      setCopyError("Name is required");
      return;
    }
    const sourceId = copyTarget.id;
    setCopySaving(true);
    setCopyError(null);

    apiGetAuth<SessionDetail>(`/api/draft/sessions/${sourceId}`)
      .then(async (original) => {
        const notesResp = await apiGetAuth<{ items: { playerId: string; note: string }[] }>(
          `/api/draft/sessions/${sourceId}/notes`,
        ).catch(() => ({ items: [] }));

        const created = await apiPostAuth<
          SessionDetail,
          { name: string; config: DraftConfigServer; picks: DraftPick[] }
        >("/api/draft/sessions", {
          name,
          config: original.config,
          picks: original.picks,
        });

        if (notesResp.items.length > 0) {
          await Promise.all(
            notesResp.items.map((n) =>
              apiPutAuth<{ status: string }, { note: string }>(
                `/api/draft/sessions/${created.id}/notes/${encodeURIComponent(n.playerId)}`,
                { note: n.note },
              ).catch((err: unknown) => {
                console.error(`Failed to copy note for ${n.playerId}:`, err);
              }),
            ),
          );
        }

        setCopySaving(false);
        setCopyTarget(null);
        setCopyNameInput("");
        pushToast(`Copied as "${created.name}".`, "success");
        refreshSessionList();
      })
      .catch((err: unknown) => {
        console.error(err);
        setCopySaving(false);
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Maximum")) {
          setCopyError("Reached max session count. Delete one and try again.");
        } else {
          setCopyError(msg || "Copy failed");
        }
      });
  };

  const handleSessionDelete = (id: number) => {
    if (!confirm("Delete this session?")) return;
    apiDeleteAuth<{ status: string; sessionId: number }>(`/api/draft/sessions/${id}`)
      .then(() => {
        // If the currently active session is deleted, redirect home
        if (isLoadedMode && sessionId === id) {
          closeImportModal();
          navigate("/", { replace: true });
          return;
        }
        refreshSessionList();
      })
      .catch((err: unknown) => {
        console.error(err);
        alert("Delete failed");
      });
  };

  if (!bootstrapped || !config) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        Loading draft...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DraftHeaderBar
        sessionName={sessionName}
        config={config}
        hasDraftConfig={hasDraftConfig}
        isLoadedMode={isLoadedMode}
        rosterSize={rosterSize}
        remainingBudget={remainingBudget}
        authed={authed}
        canUndoPicks={canUndoPicks}
        canRedoPicks={canRedoPicks}
        onUndo={undoPicks}
        onRedo={redoPicks}
        onDiscard={handleDiscardDraft}
        onNew={handleNewDraft}
        onSave={handleSaveClick}
        onImport={openImportModal}
        onStartDraft={openStartDraft}
        onRename={openRenameModal}
      />

      <FadeIn delayMs={60}>
        <div ref={draftRoomTopRef}>
          {authed && hasDraftConfig ? (
            <DraftRoomBoard
              teams={teams}
              slotTemplate={slotTemplate}
              picks={picks}
              playersById={playersById}
              currentRound={currentRound}
              totalRounds={rosterSize}
              authed={authed}
              view={boardView}
              onViewChange={setBoardView}
              onRemovePick={handleRemovePick}
              onSlotReassign={handleSlotReassign}
              onOpenHistory={() => setHistoryModalOpen(true)}
            />
          ) : (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <div className="text-2xl font-black text-white">
                Ready to draft?
              </div>
              <div className="mt-2 text-sm text-white/60">
                {authed
                  ? "Use the Start Draft button above to set up your league."
                  : "Sign in and use the Start Draft button above to set up your league."}
              </div>
            </section>
          )}
        </div>
      </FadeIn>

      <PlayerSearchToolbar
        query={query}
        onChangeQuery={(next) => {
          setQuery(next);
          setPage(1);
        }}
        sort={sort}
        sortOptions={sortOptions}
        onChangeSort={(next) => {
          setSort(next);
          setPage(1);
        }}
        positionFilters={positionFilters}
        position={position}
        onChangePosition={(next) => {
          setPosition(next);
          setPage(1);
        }}
        hasDraftConfig={hasDraftConfig}
        remainingBudget={remainingBudget}
      />

      <ComparisonPanel
        selectedA={selectedAWithBid}
        selectedB={selectedBWithBid}
        authed={authed}
        onClearA={clearCompareA}
        onClearB={clearCompareB}
        onClearAll={clearCompare}
        onOpenComparison={() => setComparisonOpen(true)}
      />

      <StatPickerStrip
        group={showingPitcherColumns ? "pitcher" : "batter"}
        cols={showingPitcherColumns ? pitcherCols : batterCols}
        onChange={showingPitcherColumns ? setPitcherCols : setBatterCols}
        onReset={() => resetStatColumns(showingPitcherColumns ? "pitcher" : "batter")}
      />

      <PlayerListTable
        players={players}
        picks={picks}
        teams={teams}
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        onChangePage={setPage}
        statColumnLabels={statColumnLabels}
        batterCols={batterCols}
        pitcherCols={pitcherCols}
        loading={loading}
        error={error}
        authed={authed}
        hasDraftConfig={hasDraftConfig}
        notes={notes}
        compareAId={compareAId}
        compareBId={compareBId}
        onAddPick={handleAddClick}
        onTakenPick={openTakenModal}
        onOpenNote={openNoteModal}
        onOpenPlayerInfo={openPlayerInfo}
        onToggleCompare={handleCompareToggle}
      />

      {addTarget && (
        <AddBidModal
          key={`add-${addTarget.id}`}
          open={true}
          player={addTarget}
          remainingBudget={remainingBudget}
          recommendedBid={addTargetBid}
          bidLoading={addTargetBidLoading}
          onClose={closeAddModal}
          onConfirm={handleAddFinish}
        />
      )}

      {takenTarget && (
        <TakenBidModal
          key={`taken-${takenTarget.id}-${boardView}`}
          open={true}
          player={takenTarget}
          teams={teams}
          remainingBudgetByTeam={remainingBudgetByTeam}
          kind={boardView}
          onClose={closeTakenModal}
          onConfirm={handleTakenFinish}
        />
      )}

      <PlayerComparisonModal
        open={comparisonOpen && Boolean(selectedAWithBid) && Boolean(selectedBWithBid)}
        playerA={selectedAWithBid}
        playerB={selectedBWithBid}
        onClose={() => setComparisonOpen(false)}
      />

      <PlayerInfoModal
        open={profilePlayerId !== null}
        playerId={profilePlayerId}
        playerType={profilePlayerType}
        onClose={closePlayerInfo}
      />

      {noteTarget && (
        <PlayerNotePopover
          open={true}
          playerName={noteTarget.name}
          initialNote={notes[noteTarget.id] ?? ""}
          saving={noteSaving}
          onSave={handleNoteSave}
          onClose={closeNoteModal}
        />
      )}

      {saveModalOpen && (
        <SaveSessionModal
          isLoadedMode={isLoadedMode}
          nameInput={saveNameInput}
          onChangeName={(next) => {
            setSaveNameInput(next);
            if (saveError) setSaveError(null);
          }}
          error={saveError}
          saving={saving}
          onCancel={closeSaveModal}
          onConfirm={handleSaveConfirm}
        />
      )}

      {renameModalOpen && (
        <RenameSessionModal
          nameInput={renameInput}
          onChangeName={(next) => {
            setRenameInput(next);
            if (renameError) setRenameError(null);
          }}
          error={renameError}
          saving={renameSaving}
          onCancel={closeRenameModal}
          onConfirm={handleRenameConfirm}
        />
      )}

      {importModalOpen && (
        <ImportSessionsModal
          sessions={sessionList}
          loading={sessionListLoading}
          onClose={closeImportModal}
          onPick={handleSessionPick}
          onDelete={handleSessionDelete}
          onCopy={handleSessionCopy}
        />
      )}

      {copyTarget !== null && (
        <CopySessionModal
          nameInput={copyNameInput}
          onChangeName={setCopyNameInput}
          error={copyError}
          copying={copySaving}
          onCancel={closeCopyModal}
          onConfirm={handleCopyConfirm}
        />
      )}

      {newConfirmOpen && (
        <NewDraftConfirmModal
          onSaveFirst={handleNewConfirmSaveFirst}
          onDiscardCurrent={handleNewConfirmDiscard}
          onCancel={handleNewConfirmCancel}
        />
      )}

      <Modal
        open={setupModalOpen}
        title="Start Your Draft"
        onClose={() => setSetupModalOpen(false)}
      >
        <DraftSetupCard embedded onSubmit={handleSetupSubmit} />
      </Modal>

      <LoginPromptModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onAuthSuccess={() => setSetupModalOpen(true)}
      />

      <OrderedDraftHistoryModal
        open={historyModalOpen}
        picks={picks}
        teams={teams}
        playersById={playersById}
        onClose={() => setHistoryModalOpen(false)}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />

      {pendingStartDraft && (
        <div className="fixed inset-0 z-100 grid place-items-center bg-black/50 backdrop-blur-md">
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0c1220] px-6 py-5 shadow-2xl">
            <svg
              className="h-5 w-5 animate-spin text-white/80"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 0 1 8-8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="text-sm font-black text-white">
              Loading player values...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
