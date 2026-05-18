// Draft Room — the main feature page.
// Displays: draft board (team rosters), player list with search/filter/sort,
// player comparison panel, Add/Taken bid modals, and player info modal.
//
// Option A 데이터 흐름:
//   1. 마운트 분기:
//      - useParams.sessionId 있음 → GET /api/draft/sessions/{id} → React state
//      - sessionId 없음 → sessionStorage["ppadun_unsaved_draft"] → React state
//      - 둘 다 없으면 홈으로 리다이렉트
//   2. 공개 GET /api/draft/players → 선수 목록 (값 없음)
//   3. POST /api/draft/players/values, body { config, picks } → 머지용 값
//   4. 픽 추가/삭제는 React state 만 갱신. 미저장 모드면 sessionStorage 도 sync.
//   5. Save 버튼만이 유일한 서버 커밋 포인트 (POST 또는 PUT /api/draft/sessions[/id]).
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
  BATTER_SORT_OPTIONS,
  DEFAULT_DRAFT_CONFIG,
  DEFAULT_POSITION_FILTERS,
  PITCHER_SORT_OPTIONS,
  UNSAVED_DRAFT_KEY,
  arePlayersComparable,
  buildTeamsFromConfig,
  initialNameFor,
  isPitcherPositionFilter,
  matchesPositionFilter,
  mergePlayersWithValues,
  powerSortValue,
  primaryRateSortValue,
  productionSortValue,
  removeUnsavedDraftStorage,
  setActiveDraftSessionId,
  speedSortValue,
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

// Notification event_type → toast prefix + variant 매핑.
// 알 수 없는 type 은 일반 알림 fallback.
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

  // "Start Your Draft" 버튼이 띄우는 setup / 로그인 유도 모달.
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  // Start Draft 직후 PPA 값 첫 응답을 기다리는 동안 페이지 전체를 블러로 덮어둔다.
  // 이후 픽 변경에 따른 재계산은 overlay 없이 백그라운드에서 갱신.
  const [pendingStartDraft, setPendingStartDraft] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // "New" → "Save first?" Yes 경로에서 Save 가 끝난 직후 setup 모달을
  // 자동으로 열기 위한 플래그. Save 모달이 cancel 되면 클리어.
  const [postSaveAction, setPostSaveAction] = useState<"setup" | null>(null);

  // "New" 클릭 시 띄우는 3-버튼 확인 모달 — 미저장 상태에서만 사용.
  const [newConfirmOpen, setNewConfirmOpen] = useState(false);

  // Toast queue. id 는 monotonic counter 로 부여한다.
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

  // 핵심 드래프트 state — 마운트 시 한 번 채워지고 이후 모든 픽 변경은 React state 만 갱신.
  const [config, setConfig] = useState<DraftConfigServer | null>(null);
  const [hasDraftConfig, setHasDraftConfig] = useState(false);
  const [teams, setTeams] = useState<DraftTeam[]>([]);
  // picks 는 useUndoStack 으로 관리해 undo / redo 를 지원한다.
  //   - commitPicks: 사용자 행동에 의한 변경 (영입/제거/슬롯 이동) → 이력에 push
  //   - resetPicks:  세션 전환 / 새 draft 시작 등 이력을 끊는 변경
  const {
    state: picks,
    commit: commitPicks,
    reset: resetPicks,
    undo: undoPicks,
    redo: redoPicks,
    canUndo: canUndoPicks,
    canRedo: canRedoPicks,
  } = useUndoStack<DraftPick[]>([]);

  // 키보드 단축키 — Ctrl/Cmd+Z = undo, Ctrl+Y / Ctrl·Cmd+Shift+Z = redo.
  // input / textarea / contenteditable 안에서는 무시 (브라우저 기본 undo 유지).
  useUndoKeyboardShortcuts({
    onUndo: undoPicks,
    onRedo: redoPicks,
    canUndo: canUndoPicks,
    canRedo: canRedoPicks,
  });
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // 공개 API 에서 받아온 기본 목록 (값 없음)
  const [publicPlayers, setPublicPlayers] = useState<DraftPlayerPublic[]>([]);
  // 인증 API 에서 받아온 값 테이블 — 비로그인 또는 조회 실패 시 null
  const [playerValues, setPlayerValues] = useState<DraftPlayerValue[] | null>(null);

  const [query, setQuery] = useState(() => searchParams.get("query")?.trim() ?? "");
  const [position, setPosition] = useState<DraftPositionFilter>("C");
  const [sort, setSort] = useState<DraftSort>("score_desc");
  const [page, setPage] = useState(1);

  // 필터/정렬 옵션은 더 이상 서버가 내려주지 않음 — 상수 그대로 사용
  const positionFilters = DEFAULT_POSITION_FILTERS;
  const showingPitcherColumns = isPitcherPositionFilter(position);
  const sortOptions = showingPitcherColumns ? PITCHER_SORT_OPTIONS : BATTER_SORT_OPTIONS;

  // 사용자가 선택한 5개 스탯 (타자/투수 별도) — localStorage에 영구 저장.
  const { batterCols, pitcherCols, setBatterCols, setPitcherCols, resetToDefaults: resetStatColumns } = useStatColumns();
  const activeStatKeys = showingPitcherColumns ? pitcherCols : batterCols;
  // 슬롯이 null 이면 헤더 라벨도 빈 문자열 — 좌우 컬럼이 안 밀리도록.
  const statColumnLabels = activeStatKeys.map((k) => (k ? getStatDef(k)?.label ?? k : ""));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player comparison state
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);
  const [profilePlayerType, setProfilePlayerType] = useState<"batter" | "pitcher">("batter");

  // 선수 메모 저장 중 indicator — 모달의 Save 버튼 disabled / 로딩 표시용.
  const [noteSaving, setNoteSaving] = useState(false);

  // 현재 보고 있는 보드 — 메인/마이너/택시. DraftRoomBoard 의 포스트잇 탭으로 전환.
  // Add/Taken 액션은 이 view 의 kind 로 픽을 생성한다.
  const [boardView, setBoardView] = useState<DraftPickKind>("main");

  const [addTarget, setAddTarget] = useState<DraftPlayer | null>(null);
  // Add 모달이 열릴 때 즉석에서 단건 호출하는 추천 bid + 그 in-flight 상태.
  const [addTargetBid, setAddTargetBid] = useState<number | null>(null);
  const [addTargetBidLoading, setAddTargetBidLoading] = useState(false);
  const [takenTarget, setTakenTarget] = useState<DraftPlayer | null>(null);

  // 메모 — playerId → note. 로드 모드에서만 fetch/저장 동작 (세션 ID 필요).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteTarget, setNoteTarget] = useState<DraftPlayer | null>(null);
  // 15초마다 백엔드 알림 폴링. 한 cycle에서 새 이벤트가 여러 개 들어오면
  // toast 폭격을 피하려고 한 개로 합쳐서 보여준다 (가장 최근 이벤트 메시지 + 카운트).
  useNotificationPolling((evs: NotificationEvent[]) => {
    if (evs.length === 0) return;

    if (evs.length === 1) {
      const ev = evs[0];
      const { prefix, variant } = notificationDisplay(ev.event_type);
      pushToast(`${prefix} — ${ev.message}`, variant);
      return;
    }

    // 여러 개 — 가장 최근 (id가 가장 큰) 이벤트를 대표로 표시하고 나머지는 카운트로.
    const sorted = [...evs].sort((a, b) => b.id - a.id);
    const latest = sorted[0];
    const { prefix, variant } = notificationDisplay(latest.event_type);
    pushToast(
      `${prefix} — ${latest.message} (+${evs.length - 1} more)`,
      variant
    );
  }, authed);

  // Save / Import 모달
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const rosterSize = useMemo(
    () => clampRosterSize(config?.rosterPlayers),
    [config?.rosterPlayers]
  );
  // 옛 세션엔 rosterSlots 가 없을 수 있으므로 기본값 fallback.
  const rosterSlotCounts = useMemo(
    () => config?.rosterSlots ?? DEFAULT_ROSTER_SLOTS,
    [config?.rosterSlots]
  );
  const slotTemplate = useMemo(
    () => buildSlotTemplateFromCounts(rosterSlotCounts),
    [rosterSlotCounts]
  );

  // 공개 선수 목록 + 인증 값 목록을 playerId 로 머지한 최종 UI 목록
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
      switch (sort) {
        case "avg_desc":
          return primaryRateSortValue(b) - primaryRateSortValue(a);
        case "hr_desc":
          return powerSortValue(b) - powerSortValue(a);
        case "rbi_desc":
          return productionSortValue(b) - productionSortValue(a);
        case "sb_desc":
          return speedSortValue(b) - speedSortValue(a);
        case "score_desc":
        default:
          return (b.ppaValue ?? 0) - (a.ppaValue ?? 0);
      }
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

  // 포지션 필터를 바꾸면 paginated `players` 에서 사라질 수 있으므로 전체 lookup 사용.
  const selectedA = compareAId ? playersById[compareAId] ?? null : null;
  const selectedB = compareBId ? playersById[compareBId] ?? null : null;

  // Compare 슬롯/모달/AI 모두 recommendedBid 를 필요로 함 — 선택되는 즉시 단건 호출로 미리 채움.
  // 같은 선수가 재선택되면 다시 안 부르고, A/B 가 비면 즉시 null 로 reset.
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

  // 메모 팝오버 — 로드된 세션에서만 사용 가능 (미저장 모드는 버튼 자체가 비활성화됨).
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

    // 미저장 모드 — sessionStorage 동기화 effect 가 알아서 잡아가므로 여기서 state만 갱신.
    if (sessionId === null) {
      applyLocal();
      setNoteTarget(null);
      return;
    }

    // 저장된 세션 — 즉시 서버에 PUT.
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

  // Start Your Draft 모달에서 입력한 config 로 page state 를 갱신.
  // sessionStorage 도 함께 저장해 같은 탭에서 이동/새로고침해도 resume 되도록 한다.
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
      // 쿼터 초과 등은 조용히 무시.
    }
    setConfig(config);
    setTeams(buildTeamsFromConfig(config));
    resetPicks([]);
    setNotes({});
    setHasDraftConfig(true);
    setSetupModalOpen(false);
    // 다음 useEffect 가 새 config 로 PPA 값을 다시 fetch 한다 — overlay 가 그 동안 노출됨.
    setPendingStartDraft(true);
  };

  // 비로그인이면 로그인 모달, 로그인 상태면 setup 모달.
  const openStartDraft = () => {
    if (authed) {
      setSetupModalOpen(true);
    } else {
      setLoginModalOpen(true);
    }
  };

  // 모든 로컬 상태 / sessionStorage 를 초기화해 "갓 들어온" 상태로 만든 다음
  // setup 모달을 띄움. 로드 모드였다면 URL 도 /draft 로 바꿔서 사이드 효과 차단.
  const resetToFreshSetup = () => {
    try {
      removeUnsavedDraftStorage();
    } catch {
      // 무시
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

  // New 버튼 — 현재 드래프트를 정리하고 새로 시작하는 setup 모달을 띄움.
  //   - 로드된 세션 (isLoadedMode): 이미 DB 에 저장돼 있으니 즉시 setup.
  //   - 미저장 드래프트: 3-버튼 확인 모달 (Save first / Discard current / Cancel)
  //     로 분기. Cancel 은 진짜 abort — 드래프트 상태 변경 없음.
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
    // 진짜 cancel — 아무 상태도 변경하지 않음.
    setNewConfirmOpen(false);
  };

  // 진행 중인 미저장 draft 폐기 — sessionStorage 비우고 player browser 상태로 복귀.
  // 저장된 세션(isLoadedMode)은 이 버튼 자체가 노출되지 않으므로 분기 필요 없음.
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

  // 세션 부트스트랩 + 메모 패치 — 두 useEffect 를 캡슐화한 훅에 위임.
  // 동작은 100% 동일: 로드 모드는 GET session detail + notes, 미저장 모드는
  // sessionStorage 에서 resume 또는 DEFAULT_DRAFT_CONFIG 폴백.
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

  // My Team 페이지가 "현재 활성 드래프트 세션" 을 알도록 sessionStorage 에 mirror.
  // 로드 모드 → 그 sessionId, 미저장(또는 fresh) → null.
  // → My Team 페이지가 옛 URL ?sessionId 로 잘못된 세션을 보여주는 문제 차단.
  useEffect(() => {
    if (isLoadedMode && sessionId !== null) {
      setActiveDraftSessionId(sessionId);
    } else {
      setActiveDraftSessionId(null);
    }
  }, [isLoadedMode, sessionId]);

  // 미저장 모드에서 picks/notes 가 바뀔 때마다 sessionStorage 에도 sync — 페이지 이동/새로고침 보호.
  useEffect(() => {
    if (isLoadedMode || !bootstrapped || !config || !hasDraftConfig) return;
    try {
      sessionStorage.setItem(
        UNSAVED_DRAFT_KEY,
        JSON.stringify({ config, picks, notes } satisfies UnsavedDraft)
      );
    } catch {
      // 쿼터 초과 등은 조용히 무시 — 새로고침 보호 실패해도 화면 동작에는 영향 없음.
    }
  }, [isLoadedMode, bootstrapped, config, hasDraftConfig, picks, notes]);

  // 공개 선수 목록 — leagueType 이 바뀌면 다시 불러온다.
  // AL/NL 은 ?league= 쿼리로 백엔드 필터링, 그 외(custom 등)는 전체.
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

  // 인증된 사용자에게만 PPA 값을 불러와 playerId 로 공개 목록과 머지한다.
  // recommendedBid 는 Add 모달이 열릴 때 단건으로 따로 호출 (POST /api/draft/players/bid).
  // 로그아웃 시 값을 즉시 지워서 UI 에 남지 않도록 함.
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

  // Compare A 가 바뀔 때마다 단건 bid 호출 — Compare 슬롯/모달/AI 가 같이 사용한다.
  // 선택이 바뀌는 순간 옛 bid 가 새 선수에게 잘못 적용되지 않도록 microtask 로 reset.
  // picks 는 fetch payload 에만 들어가고 deps 에는 빠짐 — 픽 마다 재호출하면 비싸기 때문.
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

  // bid 가 채워진 선수 객체 — ComparisonPanel / PlayerComparisonModal / AI 추천 모두 동일한 객체 사용.
  const selectedAWithBid = useMemo(
    () => (selectedA ? { ...selectedA, recommendedBid: compareBidA } : null),
    [selectedA, compareBidA],
  );
  const selectedBWithBid = useMemo(
    () => (selectedB ? { ...selectedB, recommendedBid: compareBidB } : null),
    [selectedB, compareBidB],
  );

  // Toggle player selection for A/B comparison (max 2 players).
  // 타자/투수 혼합 비교는 차단하고 토스트로 안내한다.
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
        : selectedA; // 둘 다 차 있으면 B 를 교체 → A 와 비교 가능해야 함

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

  // 픽 제거 — 서버 호출 없이 React state 만 갱신. 미저장 모드면 localStorage sync 는 별도 effect 에서.
  const handleRemovePick = (pick: DraftPick) => {
    commitPicks((prev) => prev.filter((p) => p.playerId !== pick.playerId));
  };

  // 드래그-드롭으로 슬롯/팀을 옮길 때:
  //  - 같은 팀: 메인은 자격 검사 후 이동/스왑, 마이너·택시는 순수 재정렬.
  //  - 다른 팀: 빈 슬롯 + 자격(메인) 일 때만 이동. occupied 면 스왑 대신 토스트로 안내.
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

    // 팀 간 이동: occupied 면 스왑 안 함, 토스트로 안내.
    if (isCrossTeam && toPick) {
      const targetTeam = teams.find((t) => t.id === toTeamId);
      pushToast(
        `${targetTeam?.name ?? "Target team"} already has a player in that slot.`,
        "error",
      );
      return;
    }

    // 마이너/택시: 자격 검사 없이 처리.
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

    // 팀 간 이동 (빈 슬롯 확인은 위에서 끝남): teamId + slotIndex + slotPos 교체.
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

    // 같은 팀 — 빈 target → 단순 이동.
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

    // 같은 팀 — occupied target → 양방향 자격 모두 OK 일 때만 스왑.
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

  // 픽 추가 시 클라이언트가 즉시 slotIndex 결정.
  // 같은 playerId 의 기존 픽은 제외 → 같은 팀+kind occupied 슬롯 집합 → 빈 슬롯 찾기.
  // 메인은 포지션 자격 매칭, 마이너/택시는 그냥 첫 빈 자리.
  // -1 이면 자리 없음 알림 후 종료.
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

    // signedSeason 은 현재 세션의 targetSeason 을 그대로 박는다 (rollover 의 기준점).
    // contractCode 가 없으면 signedSeason 도 의미 없어 함께 null.
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

  // Add 버튼 클릭 — 메인이면 bid 모달 (열면서 단건 bid fetch), 마이너/택시는 바로 추가.
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

  // ── Save 버튼 핸들러 ──
  const openSaveModal = () => {
    setSaveNameInput(initialNameFor(sessionName));
    setSaveError(null);
    setSaveModalOpen(true);
  };

  const closeSaveModal = () => {
    setSaveModalOpen(false);
    setSaveError(null);
    // 사용자가 Save 를 취소하면 chained post-save action 도 함께 폐기.
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
          // closeSaveModal 은 postSaveAction 도 클리어하므로, chain 동작이
          // 예약돼 있었다면 그 사실을 먼저 캡처한 뒤 닫는다.
          const chained = postSaveAction;
          closeSaveModal();
          if (chained === "setup") {
            // 저장된 세션을 그대로 두고 새 setup 으로 이동.
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
        // 미저장 동안 쌓인 로컬 메모를 새 session_id 로 일괄 PUT.
        // 개별 실패는 무시 — 메모는 부수 데이터이고, 세션 자체는 이미 성공했음.
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
          // 무시
        }
        setSaving(false);
        setSaveModalOpen(false);

        if (postSaveAction === "setup") {
          // "New" 흐름에서 Yes-save 를 거친 경우 — 새로 만든 세션 URL 로
          // 이동하지 않고, 곧바로 새 setup 모달을 띄운다. (세션은 DB 에
          // 저장돼 있으므로 추후 Import 에서 다시 열 수 있다.)
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

  // ── Import 모달 핸들러 ──
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  // Copy 흐름: Copy 버튼 클릭 시 rename 모달을 띄우고, Confirm 시 실제 POST.
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

  // Copy 버튼 클릭: rename 모달을 띄운다. 실제 POST 는 handleCopyConfirm.
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

  // Confirm: 원본 세션 + 메모 로드 → 사용자가 입력한 이름으로 새 세션 POST.
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
        // 현재 활성 세션 삭제 시 홈으로 리다이렉트
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
        onSave={openSaveModal}
        onImport={openImportModal}
        onStartDraft={openStartDraft}
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
