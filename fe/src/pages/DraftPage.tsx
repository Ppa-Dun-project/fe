// Draft Room — the main feature page.
// Displays: draft board (team rosters), player list with search/filter/sort,
// player comparison panel, Add/Taken bid modals, and player info modal.
//
// Option A 데이터 흐름:
//   1. 마운트 분기:
//      - useParams.sessionId 있음 → GET /api/draft/sessions/{id} → React state
//      - sessionId 없음 → localStorage["ppadun_unsaved_draft"] → React state
//      - 둘 다 없으면 홈으로 리다이렉트
//   2. 공개 GET /api/draft/players → 선수 목록 (값 없음)
//   3. POST /api/draft/players/values, body { config, picks } → 머지용 값
//   4. 픽 추가/삭제는 React state 만 갱신. 미저장 모드면 localStorage 도 sync.
//   5. Save 버튼만이 유일한 서버 커밋 포인트 (POST 또는 PUT /api/draft/sessions[/id]).
//
// Filtering, sorting, and pagination all run client-side on the merged list.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";
import Dropdown from "../components/ui/Dropdown";
import { useAuth } from "../lib/auth";
import { apiGet, apiGetAuth, apiPostAuth, apiPutAuth, apiDeleteAuth } from "../lib/api";

import type {
  DraftConfigServer,
  DraftPick,
  DraftPlayer,
  DraftPlayerPublic,
  DraftPlayerValue,
  DraftPositionFilter,
  DraftSort,
  DraftTeam,
  PlayerNote,
  SessionDetail,
  SessionSummary,
} from "../types/draft";
type DraftPosition = DraftPlayer["positions"][number];

import {
  DEFAULT_ROSTER_SLOTS,
  buildSlotTemplateFromCounts,
  calculateCurrentRound,
  calculateRemainingBudget,
  clampRosterSize,
  draftCostClass,
  findEligibleSlotIndex,
  formatAvg,
  getPlayerDraftStatus,
  isEligibleForSlot,
  mlbTeamBadgeClass,
  sumRosterSlots,
} from "../features/draft/utils";
import { formatPpa, ppaValueClass } from "../utils/playerValue";

import DraftRoomBoard from "../features/draft/components/DraftRoomBoard";
import AddBidModal from "../features/draft/components/AddBidModal";
import TakenBidModal from "../features/draft/components/TakenBidModal";
import PlayerComparisonModal from "../features/draft/components/PlayerComparisonModal";
import PlayerNotePopover from "../features/draft/components/PlayerNotePopover";
import PlayerInfoModal from "../features/players/components/PlayerInfoModal";
import Pagination from "../features/players/components/Pagination";
import Modal from "../components/ui/Modal";
import Toast, { type ToastMessage, type ToastVariant } from "../components/ui/Toast";
import { useUndoStack } from "../hooks/useUndoStack";
import DraftSetupCard, { type DraftSetupConfig } from "../features/home/DraftSetupCard";
import LoginPromptModal from "../features/auth/LoginPromptModal";

const PAGE_SIZE = 30;

const DEFAULT_POSITION_FILTERS: DraftPositionFilter[] = [
  "ALL",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "UTIL",
  "P",
];

// Match a player against a position filter.
// - ALL   : always true
// - UTIL  : any non-pitcher position (1B/2B/3B/SS/OF/C/UTIL all qualify)
// - P     : any pitcher position (SP or RP)
// - other : exact match (case-insensitive, defensive against empty arrays)
function matchesPositionFilter(
  playerPositions: readonly string[] | undefined,
  filter: DraftPositionFilter
): boolean {
  if (filter === "ALL") return true;
  if (!playerPositions || playerPositions.length === 0) return false;

  const normalized = playerPositions.map((p) => p.toUpperCase());

  if (filter === "UTIL") {
    return normalized.some((p) => p !== "SP" && p !== "RP");
  }
  if (filter === "P") {
    return normalized.some((p) => p === "SP" || p === "RP");
  }
  return normalized.includes(filter);
}

function isPitcherOnly(player: DraftPlayerPublic): boolean {
  return player.playerType === "pitcher";
}

function isPitcherPositionFilter(filter: DraftPositionFilter): boolean {
  return filter === "P" || filter === "SP" || filter === "RP";
}

function formatNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(digits);
}

function formatDraftStatSummary(player: DraftPlayerPublic) {
  if (isPitcherOnly(player)) {
    return `ERA ${formatNumber(player.era, 2)} | SO ${player.so ?? "-"} | W ${player.w ?? "-"} | SV ${player.sv ?? "-"} | IP ${formatNumber(player.ip, 1)}`;
  }
  return `AVG ${formatAvg(player.avg)} | HR ${player.hr ?? "-"} | RBI ${player.rbi ?? "-"} | SB ${player.sb ?? "-"} | AB ${player.ab ?? "-"}`;
}

function primaryRateSortValue(player: DraftPlayerPublic) {
  if (isPitcherOnly(player)) {
    return player.era === null || player.era === undefined ? 0 : -player.era;
  }
  return player.avg ?? 0;
}

function powerSortValue(player: DraftPlayerPublic) {
  return isPitcherOnly(player) ? player.so ?? 0 : player.hr ?? 0;
}

function productionSortValue(player: DraftPlayerPublic) {
  return isPitcherOnly(player) ? player.w ?? 0 : player.rbi ?? 0;
}

function speedSortValue(player: DraftPlayerPublic) {
  return isPitcherOnly(player) ? player.sv ?? 0 : player.sb ?? 0;
}

const BATTER_SORT_OPTIONS: { value: DraftSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc", label: "By Draft Cost" },
  { value: "avg_desc", label: "By AVG" },
  { value: "hr_desc", label: "By HR" },
  { value: "rbi_desc", label: "By RBI" },
  { value: "sb_desc", label: "By SB" },
];

const PITCHER_SORT_OPTIONS: { value: DraftSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc", label: "By Draft Cost" },
  { value: "avg_desc", label: "By ERA" },
  { value: "hr_desc", label: "By SO" },
  { value: "rbi_desc", label: "By W" },
  { value: "sb_desc", label: "By SV" },
];

// 공개 /api/draft/players — PPA 값 / 추천 bid 없이 전체 선수 목록만
type DraftPlayersResponse = {
  items: DraftPlayerPublic[];
};

// POST /api/draft/players/values — body { config, picks } → 값 목록
type DraftPlayerValuesResponse = {
  items: DraftPlayerValue[];
};

// GET /api/draft/sessions — Import 모달용 목록
type SessionsListResponse = {
  items: SessionSummary[];
};

const UNSAVED_DRAFT_KEY = "ppadun_unsaved_draft";

const DEFAULT_DRAFT_CONFIG: DraftConfigServer = {
  leagueType: "AL",
  budget: 260,
  rosterPlayers: sumRosterSlots(DEFAULT_ROSTER_SLOTS),
  myTeamName: "My Team",
  opponentsCount: 11,
  oppTeamNames: Array.from({ length: 11 }, (_, i) => `Opponent ${i + 1}`),
  rosterSlots: DEFAULT_ROSTER_SLOTS,
};

// 미저장 모드의 localStorage 페이로드 — DraftSetupCard 가 쓰고 DraftPage 가 읽음
type UnsavedDraft = {
  config: DraftConfigServer;
  picks: DraftPick[];
  notes?: Record<string, string>; // playerId → note (미저장 동안 클라이언트 보관)
};

// 미저장 모드에서 config 만으로 teams 배열을 만든다.
// 저장 시 서버가 자체 ID 로 다시 만들어 주므로 여기 ID 는 클라이언트 임시 키로만 사용.
function buildTeamsFromConfig(config: DraftConfigServer): DraftTeam[] {
  const teams: DraftTeam[] = [
    { id: "team-0", name: config.myTeamName, isMine: true },
  ];
  for (let i = 0; i < config.opponentsCount; i += 1) {
    teams.push({
      id: `team-${i + 1}`,
      name: config.oppTeamNames[i] ?? `Opponent ${i + 1}`,
      isMine: false,
    });
  }
  return teams;
}

function normalizeDraftTeamId(teamId: string) {
  if (teamId === "me" || teamId === "team-me") return "team-0";
  const legacyOpponent = /^opp(\d+)$/.exec(teamId);
  if (legacyOpponent) return `team-${Number(legacyOpponent[1]) + 1}`;
  return teamId;
}

function normalizeDraftPicks(picks: DraftPick[]) {
  return picks.map((pick) => ({
    ...pick,
    draftedByTeamId: normalizeDraftTeamId(pick.draftedByTeamId),
  }));
}

// 공개 선수 목록과 인증 값 목록을 playerId 기준으로 머지
function mergePlayersWithValues(
  publicPlayers: DraftPlayerPublic[],
  values: DraftPlayerValue[] | null
): DraftPlayer[] {
  if (!values) return publicPlayers.map((player) => ({ ...player }));

  const valueById = new Map(values.map((v) => [v.playerId, v]));
  return publicPlayers.map((player) => {
    const v = valueById.get(player.id);
    return v
      ? { ...player, ppaValue: v.ppaValue, recommendedBid: v.recommendedBid }
      : { ...player };
  });
}

// "Untitled Draft" 같은 자동 이름은 Save 모달에서 빈 입력으로 시작해야 한다.
function initialNameFor(currentName: string | null): string {
  if (!currentName) return "";
  if (currentName === "Untitled Draft") return "";
  return currentName;
}

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
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Toast queue. id 는 monotonic counter 로 부여한다.
  const toastIdRef = useRef(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pushToast = (text: string, variant: ToastVariant = "info") => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, variant }]);
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
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // 공개 API 에서 받아온 기본 목록 (값 없음)
  const [publicPlayers, setPublicPlayers] = useState<DraftPlayerPublic[]>([]);
  // 인증 API 에서 받아온 값 테이블 — 비로그인 또는 조회 실패 시 null
  const [playerValues, setPlayerValues] = useState<DraftPlayerValue[] | null>(null);

  const [query, setQuery] = useState(() => searchParams.get("query")?.trim() ?? "");
  const [position, setPosition] = useState<DraftPositionFilter>("ALL");
  const [sort, setSort] = useState<DraftSort>("score_desc");
  const [page, setPage] = useState(1);

  // 필터/정렬 옵션은 더 이상 서버가 내려주지 않음 — 상수 그대로 사용
  const positionFilters = DEFAULT_POSITION_FILTERS;
  const showingPitcherColumns = isPitcherPositionFilter(position);
  const sortOptions = showingPitcherColumns ? PITCHER_SORT_OPTIONS : BATTER_SORT_OPTIONS;
  const statColumnLabels = showingPitcherColumns
    ? ["ERA", "SO", "W", "SV", "IP"]
    : ["AVG", "HR", "RBI", "SB", "AB"];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player comparison state
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);
  const [profilePlayerType, setProfilePlayerType] = useState<"batter" | "pitcher">("batter");

  const [addTarget, setAddTarget] = useState<DraftPlayer | null>(null);
  const [takenTarget, setTakenTarget] = useState<DraftPlayer | null>(null);

  // 메모 — playerId → note. 로드 모드에서만 fetch/저장 동작 (세션 ID 필요).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteTarget, setNoteTarget] = useState<DraftPlayer | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

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

    if (position !== "ALL") {
      result = result.filter((p) => matchesPositionFilter(p.positions, position));
    }

    const sorted = [...result].sort((a, b) => {
      switch (sort) {
        case "cost_desc":
          return (b.recommendedBid ?? 0) - (a.recommendedBid ?? 0);
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

  const selectedA = players.find((player) => player.id === compareAId) ?? null;
  const selectedB = players.find((player) => player.id === compareBId) ?? null;

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

    // 미저장 모드 — localStorage 동기화 effect 가 알아서 잡아가므로 여기서 state만 갱신.
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
  // localStorage 도 함께 저장해 새로고침해도 resume 되도록 한다.
  const handleSetupSubmit = (next: DraftSetupConfig) => {
    const config: DraftConfigServer = {
      leagueType: next.leagueType,
      budget: next.budget,
      rosterPlayers: next.rosterPlayers,
      myTeamName: next.myTeamName,
      opponentsCount: next.opponentsCount,
      oppTeamNames: next.oppTeamNames,
      rosterSlots: next.rosterSlots,
    };
    try {
      localStorage.setItem(
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
  };

  // 비로그인이면 로그인 모달, 로그인 상태면 setup 모달.
  const openStartDraft = () => {
    if (authed) {
      setSetupModalOpen(true);
    } else {
      setLoginModalOpen(true);
    }
  };

  // 진행 중인 미저장 draft 폐기 — localStorage 비우고 player browser 상태로 복귀.
  // 저장된 세션(isLoadedMode)은 이 버튼 자체가 노출되지 않으므로 분기 필요 없음.
  const handleDiscardDraft = () => {
    if (!window.confirm("Discard the current draft? This cannot be undone.")) return;
    try {
      localStorage.removeItem(UNSAVED_DRAFT_KEY);
    } catch {
      // ignore
    }
    setConfig(DEFAULT_DRAFT_CONFIG);
    setTeams(buildTeamsFromConfig(DEFAULT_DRAFT_CONFIG));
    resetPicks([]);
    setNotes({});
    setHasDraftConfig(false);
  };

  // 마운트 분기:
  //  - sessionId 있음(로드 모드): GET /api/draft/sessions/{id}. 404 → 홈.
  //  - setup=1 있음(새 드래프트 모드): localStorage["ppadun_unsaved_draft"] 읽음.
  //  - 둘 다 없으면 Default/Guest player browser로 시작하며 saved session은 Import로만 연다.
  // 이후 모든 픽 변경은 React state 에서만 처리되며 서버에 즉시 반영되지 않는다.
  useEffect(() => {
    if (isLoadedMode) {
      const controller = new AbortController();

      apiGetAuth<SessionDetail>(
        `/api/draft/sessions/${sessionId}`,
        undefined,
        controller.signal
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          setConfig(data.config);
          setHasDraftConfig(true);
          setTeams(data.teams);
          resetPicks(normalizeDraftPicks(data.picks ?? []));
          setSessionName(data.name);
          setBootstrapped(true);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error(err);
          // 404 또는 기타 실패 → 홈으로
          navigate("/", { replace: true });
        });

      return () => controller.abort();
    }

    // 미저장 모드 — localStorage에 unsaved draft가 있으면 자동 resume.
    // 없으면 default config로 player browser 모드 (Start Your Draft 버튼 노출).
    let parsed: UnsavedDraft | null = null;
    try {
      const raw = localStorage.getItem(UNSAVED_DRAFT_KEY);
      if (raw) parsed = JSON.parse(raw) as UnsavedDraft;
    } catch {
      parsed = null;
    }

    const ready: UnsavedDraft = parsed?.config
      ? parsed
      : { config: DEFAULT_DRAFT_CONFIG, picks: [] };
    queueMicrotask(() => {
      setConfig(ready.config);
      setHasDraftConfig(Boolean(parsed?.config));
      setTeams(buildTeamsFromConfig(ready.config));
      resetPicks(normalizeDraftPicks(ready.picks ?? []));
      setNotes(ready.notes ?? {});
      setSessionName(null);
      setBootstrapped(true);
    });
  }, [isLoadedMode, navigate, sessionId]);

  // 로드 모드 — 서버에서 메모를 가져온다. 미저장 모드는 부트스트랩 effect 가 localStorage 에서 채워주므로 여기선 건드리지 않음.
  useEffect(() => {
    if (!isLoadedMode || sessionId === null) return;
    const controller = new AbortController();
    apiGetAuth<{ items: PlayerNote[] }>(
      `/api/draft/sessions/${sessionId}/notes`,
      undefined,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const map: Record<string, string> = {};
        for (const it of data.items ?? []) map[it.playerId] = it.note;
        setNotes(map);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setNotes({});
      });
    return () => controller.abort();
  }, [isLoadedMode, sessionId]);

  // 미저장 모드에서 picks/notes 가 바뀔 때마다 localStorage 에도 sync — 새로고침 보호.
  useEffect(() => {
    if (isLoadedMode || !bootstrapped || !config || !hasDraftConfig) return;
    try {
      localStorage.setItem(
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

  // 인증된 사용자에게만 PPA 값 + 추천 bid 를 불러와 playerId 로 공개 목록과 머지한다.
  // 로그아웃 시 값을 즉시 지워서 UI 에 남지 않도록 함.
  // picks/config 가 바뀔 때마다 재호출 — 잔여 예산 변동에 따라 백엔드의 추천 bid 가 갱신되기 때문.
  useEffect(() => {
    if (!authed || !config || !hasDraftConfig) {
      queueMicrotask(() => setPlayerValues(null));
      return;
    }

    const controller = new AbortController();

    apiPostAuth<DraftPlayerValuesResponse, { config: DraftConfigServer; picks: DraftPick[] }>(
      "/api/draft/players/values",
      { config, picks },
      undefined,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setPlayerValues(data.items ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setPlayerValues(null);
      });

    return () => controller.abort();
  }, [authed, config, hasDraftConfig, picks]);

  // Toggle player selection for A/B comparison (max 2 players).
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

  // 내 팀 보드 안에서 드래그로 슬롯을 옮길 때:
  //   - 대상이 비어 있으면 자격(isEligibleForSlot) 만 만족하면 이동
  //   - 대상이 차 있으면 양방향 자격(둘 다 상대 슬롯에 들어갈 수 있음)일 때만 swap
  //   - 그 외에는 toast 로 사유 설명
  const handleSlotReassign = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const myTeamId = myTeam?.id;
    if (!myTeamId) return;

    const fromSlotPos = slotTemplate[fromIndex];
    const toSlotPos = slotTemplate[toIndex];
    if (!fromSlotPos || !toSlotPos) return;

    const myPicks = picks.filter((p) => p.draftedByTeamId === myTeamId);
    const fromPick = myPicks.find((p) => p.slotIndex === fromIndex);
    if (!fromPick) return;
    const fromPlayer = playersById[fromPick.playerId];
    if (!fromPlayer) return;

    if (!isEligibleForSlot(fromPlayer.positions, toSlotPos)) {
      pushToast(`${fromPlayer.name} is not eligible for ${toSlotPos}.`, "error");
      return;
    }

    const toPick = myPicks.find((p) => p.slotIndex === toIndex);

    // Empty target → simple move.
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

    // Occupied target → swap only when both directions are eligible.
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

  // 옵션 A: 픽 추가 시 클라이언트가 즉시 slotIndex 결정.
  // 같은 playerId 의 기존 픽은 제외 → 같은 팀 occupied 슬롯 집합 → findAvailableSlotIndex.
  // -1 이면 자리 없음 알림 후 종료.
  const addPickToState = (
    playerId: string,
    draftedByTeamId: string,
    bid: number,
    type: DraftPick["type"]
  ) => {
    const filtered = picks.filter((p) => p.playerId !== playerId);
    const occupied = new Set(
      filtered.filter((p) => p.draftedByTeamId === draftedByTeamId).map((p) => p.slotIndex)
    );
    const player = playersById[playerId];
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
    const next: DraftPick = { playerId, draftedByTeamId, slotIndex, slotPos, bid, type };
    commitPicks([...filtered, next]);
    return true;
  };

  const handleAddFinish = (bid: number) => {
    if (!addTarget || !myTeam) return;
    if (!addPickToState(addTarget.id, myTeam.id, bid, "mine")) return;
    closeAddModal();
    draftRoomTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTakenFinish = (draftedByTeamId: string, bid: number) => {
    if (!takenTarget) return;
    if (!addPickToState(takenTarget.id, draftedByTeamId, bid, "taken")) return;
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
          closeSaveModal();
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
          localStorage.removeItem(UNSAVED_DRAFT_KEY);
        } catch {
          // 무시
        }
        setSaving(false);
        setSaveModalOpen(false);
        navigate(`/draft/${data.id}`, { replace: true });
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
      <FadeIn>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-black text-white/70">PPA-DUN</div>
            <h1 className="mt-1 text-3xl font-black text-white">
              {sessionName ?? "Draft Room"}
            </h1>
            {hasDraftConfig ? (
              <p className="mt-2 text-sm text-white/60">
                {String(config.leagueType ?? "AL").toUpperCase()} - ${config.budget} Budget - {rosterSize} Players
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/60">
                Browse players without starting a draft.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasDraftConfig && (
              <>
                <button
                  type="button"
                  onClick={undoPicks}
                  disabled={!canUndoPicks}
                  aria-label="Undo"
                  className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/25"
                  title="Undo the last pick change"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M9 14l-4-4 4-4" />
                    <path d="M5 10h11a4 4 0 0 1 0 8h-2" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={redoPicks}
                  disabled={!canRedoPicks}
                  aria-label="Redo"
                  className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/25"
                  title="Redo the last undone change"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M15 14l4-4-4-4" />
                    <path d="M19 10H8a4 4 0 0 0 0 8h2" />
                  </svg>
                </button>
              </>
            )}
            {hasDraftConfig && !isLoadedMode && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-200 transition hover:bg-rose-500/20"
                title="Discard the current unsaved draft and start over"
              >
                Discard
              </button>
            )}
            {authed && (
              <>
                {hasDraftConfig && (
                  <button
                    type="button"
                    onClick={openSaveModal}
                    className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/20"
                    title="Save current draft as a session"
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={openImportModal}
                  className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                  title="Import a saved session"
                >
                  Import
                </button>
              </>
            )}

            {hasDraftConfig && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-xs font-extrabold text-white/60">Remaining Budget</div>
                <div className="mt-1 text-2xl font-black text-emerald-400">${remainingBudget}</div>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

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
              myTeamId={myTeam?.id ?? null}
              onRemovePick={handleRemovePick}
              onSlotReassign={handleSlotReassign}
            />
          ) : (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <div className="text-2xl font-black text-white">
                Ready to draft?
              </div>
              <div className="mt-2 text-sm text-white/60">
                {authed
                  ? "Set up your league to start the live draft board."
                  : "Sign in and set up your league to start the live draft board."}
              </div>
              <button
                type="button"
                onClick={openStartDraft}
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-base font-black text-black transition hover:-translate-y-px hover:bg-white/90 active:translate-y-0"
              >
                Start Your Draft
              </button>
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search player name..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
              />
            </div>

            <div className="w-full lg:w-72">
              <Dropdown<DraftSort>
                label="Sort"
                value={sort}
                options={sortOptions}
                onChange={(next) => {
                  setSort(next);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {positionFilters.map((filterValue) => {
              const active = position === filterValue;
              return (
                <button
                  key={filterValue}
                  onClick={() => {
                    setPosition(filterValue);
                    setPage(1);
                  }}
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
              <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                Remaining Budget: ${remainingBudget}
              </div>
            )}
          </div>
        </section>
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
                        {selectedA.positions.join("/")} - {selectedA.team} - ${selectedA.recommendedBid ?? "—"}
                      </div>
                      <div className="mt-1 text-[10px] text-white/55">
                        {formatDraftStatSummary(selectedA)}
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
                        {selectedB.positions.join("/")} - {selectedB.team} - ${selectedB.recommendedBid ?? "—"}
                      </div>
                      <div className="mt-1 text-[10px] text-white/55">
                        {formatDraftStatSummary(selectedB)}
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
          <div className="grid grid-cols-[.4fr_1.8fr_.6fr_.8fr_.8fr_.8fr_.8fr_.8fr_.8fr_.9fr_1.3fr_1.1fr_.9fr] bg-black/40 px-4 py-3 text-xs font-extrabold text-white/60">
            <div>#</div>
            <div>Player</div>
            <div>Pos</div>
            <div>Draft Cost</div>
            <div>Team</div>
            <div>{statColumnLabels[0]}</div>
            <div>{statColumnLabels[1]}</div>
            <div>{statColumnLabels[2]}</div>
            <div>{statColumnLabels[3]}</div>
            <div>{statColumnLabels[4]}</div>
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
                      "grid grid-cols-[.4fr_1.8fr_.6fr_.8fr_.8fr_.8fr_.8fr_.8fr_.8fr_.9fr_1.3fr_1.1fr_.9fr] items-center px-4 py-3 text-sm text-white/85 transition",
                      compareActive
                        ? "relative z-[1] my-1 rounded-xl border border-emerald-400/75 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                        : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className="text-white/45">{(page - 1) * PAGE_SIZE + idx + 1}</div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openPlayerInfo(player.id, player.playerType)}
                        className="rounded-md border border-transparent px-2 py-1 -mx-2 -my-1 font-semibold text-white transition hover:border-white/35 hover:bg-white/5 hover:text-amber-200 focus-visible:border-white/45 focus-visible:bg-white/10 focus-visible:outline-none"
                      >
                        {player.name}
                      </button>
                      <button
                        type="button"
                        disabled={!authed}
                        onClick={() => openNoteModal(player)}
                        aria-label={notes[player.id] ? "Edit note" : "Add note"}
                        title={
                          !authed
                            ? "Sign in required"
                            : notes[player.id]
                            ? "Edit note"
                            : "Add note"
                        }
                        className={[
                          "grid h-7 w-7 place-items-center rounded-md border transition",
                          notes[player.id]
                            ? "border-amber-400/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                            : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
                          !authed && "cursor-not-allowed opacity-40 hover:bg-white/5",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                          <path d="M9 9h1" />
                          <path d="M9 13h6" />
                          <path d="M9 17h6" />
                        </svg>
                      </button>
                    </div>

                    <div>
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/80">
                        {player.positions[0]}
                      </span>
                    </div>

                    <div className={draftCostClass(authed)}>${player.recommendedBid ?? "—"}</div>

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

                    <div className="text-white/70">
                      {isPitcherOnly(player) ? formatNumber(player.era, 2) : formatAvg(player.avg)}
                    </div>
                    <div className="font-semibold text-amber-300">
                      {isPitcherOnly(player) ? player.so ?? "-" : player.hr ?? "-"}
                    </div>
                    <div className="text-white/70">
                      {isPitcherOnly(player) ? player.w ?? "-" : player.rbi ?? "-"}
                    </div>
                    <div className="font-semibold text-amber-300">
                      {isPitcherOnly(player) ? player.sv ?? "-" : player.sb ?? "-"}
                    </div>
                    <div className="text-white/70">
                      {isPitcherOnly(player) ? formatNumber(player.ip, 1) : player.ab ?? "-"}
                    </div>

                    <div className={`font-black ${ppaValueClass(player.ppaValue, { authed })}`}>
                      {formatPpa(player.ppaValue)}
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

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
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
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Close save dialog"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeSaveModal}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
            <div className="text-lg font-black text-white">
              {isLoadedMode ? "Save Changes" : "Save Draft"}
            </div>
            <div className="mt-1 text-xs text-white/55">
              Enter a session name (up to 3 saved sessions)
            </div>

            <input
              type="text"
              value={saveNameInput}
              onChange={(e) => {
                setSaveNameInput(e.target.value);
                if (saveError) setSaveError(null);
              }}
              placeholder="e.g. 2026 Black Sluggers"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
              autoFocus
            />

            {saveError && (
              <div className="mt-2 text-xs font-bold text-rose-300">{saveError}</div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeSaveModal}
                disabled={saving}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfirm}
                disabled={saving}
                className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Close import dialog"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeImportModal}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-white">Saved Sessions</div>
              <button
                type="button"
                onClick={closeImportModal}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/25 text-sm font-black text-white/80 hover:bg-white/10"
                aria-label="Close"
              >
                X
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20">
              {sessionListLoading && (
                <div className="p-4 text-sm text-white/65">Loading sessions...</div>
              )}

              {!sessionListLoading && sessionList.length === 0 && (
                <div className="p-4 text-sm text-white/65">No saved sessions yet.</div>
              )}

              {!sessionListLoading &&
                sessionList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 hover:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => handleSessionPick(s.id)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-black text-white">{s.name}</div>
                      <div className="mt-0.5 text-xs text-white/55">
                        {s.createdAt.slice(0, 10)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSessionDelete(s.id)}
                      aria-label="Delete session"
                      title="Delete session"
                      className="grid h-9 w-9 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                    >
                      🗑
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
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

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
