// 내 팀 페이지 (로그인 필수)
// - 드래프트 세션 단위로 동작: GET /api/my-team/players?sessionId=<id>
// - 진입 시 GET /api/draft/sessions 로 사용자 세션 목록을 조회 →
//   URL ?sessionId 가 있고 소유 세션이면 그 값, 없으면 가장 최근 세션을 default 로 사용
// - 필터/정렬/검색은 전부 프론트에서 처리 (백엔드는 원시 데이터만 제공)
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";
import Dropdown from "../components/ui/Dropdown";

import type { MyTeamPlayer, MyTeamPosFilter, MyTeamSort } from "../types/myteam";
import type { SessionSummary } from "../types/draft";
import {
  filterMyTeam,
  formatAvg,
  sortMyTeam,
} from "../features/myteam/utils";
import { mlbTeamBadgeClass } from "../features/draft/utils";
import { getActiveDraftSessionId } from "../features/draft/draftHelpers";
import { formatPpa, ppaValueClass } from "../utils/playerValue";
import { apiGetAuth } from "../lib/api";
import PlayerInfoModal from "../features/players/components/PlayerInfoModal";

// 백엔드 GET /api/my-team/players 응답 타입
type MyTeamPlayersResponse = {
  items: MyTeamPlayer[];
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
};

// 백엔드 GET /api/draft/sessions 응답 타입
type SessionsListResponse = {
  items: SessionSummary[];
};

// 예산 정보를 하나의 객체로 묶음 (useState 3번 → 1번)
type Budget = { total: number; spent: number; remaining: number };

const INITIAL_BUDGET: Budget = { total: 260, spent: 0, remaining: 260 };

// 포지션 필터 옵션 (고정)
const POSITION_FILTERS: MyTeamPosFilter[] = [
  "ALL", "C", "1B", "2B", "3B", "SS", "OF", "UTIL",
  "LF", "RF", "CF", "DH", "SP", "RP",
];

// 정렬 옵션 (고정)
const SORT_OPTIONS: { value: MyTeamSort; label: string }[] = [
  { value: "score_desc", label: "By Score" },
  { value: "cost_desc", label: "By Value $" },
  { value: "avg_desc", label: "By AVG/ERA" },
  { value: "hr_desc", label: "By HR/SO" },
  { value: "rbi_desc", label: "By RBI/W" },
  { value: "sb_desc", label: "By SB/SV" },
];

// 테이블 컬럼 그리드 정의 (헤더와 각 행에서 공유)
const TABLE_GRID_COLS =
  "grid-cols-[1.8fr_.6fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_.9fr]";

function isPitcher(player: MyTeamPlayer) {
  return player.playerType === "pitcher";
}

function formatNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(digits);
}

export default function MyTeamPage() {
  // URL ?sessionId — 소스 오브 트루스. 새로고침/공유 후에도 같은 세션을 보여주기 위함.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSessionIdRaw = searchParams.get("sessionId");

  // 세션 목록 로드 상태 (sessions === null = 아직 미조회)
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // 현재 보고 있는 세션 ID (sessions 로드 완료 후 결정됨)
  const [sessionId, setSessionId] = useState<number | null>(null);

  // 선수 데이터 로딩/에러 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 백엔드에서 받아온 선수 목록 + 예산 정보
  const [players, setPlayers] = useState<MyTeamPlayer[]>([]);
  const [budget, setBudget] = useState<Budget>(INITIAL_BUDGET);

  // 검색어 / 포지션 필터 / 정렬 상태
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<MyTeamPosFilter>("ALL");
  const [sort, setSort] = useState<MyTeamSort>("score_desc");

  // 선수 정보 모달 상태 (선택된 선수 ID)
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);
  const [profilePlayerType, setProfilePlayerType] = useState<"batter" | "pitcher">("batter");

  // ── 1단계: 세션 목록 조회 + sessionId 결정 ──
  // 우선순위:
  //   1) activeDraftSessionId (sessionStorage) — 사용자가 지금 Draft 페이지에서
  //      보고 있는 세션. "My Team 은 현재 드래프트와 연동" 시맨틱.
  //   2) URL ?sessionId — 직접 링크 / 북마크 케이스 (소유 세션일 때만).
  //   3) 그 외 → "활성 드래프트 없음" 빈 상태 (자동으로 옛 세션 불러오지 않음).
  useEffect(() => {
    const controller = new AbortController();

    apiGetAuth<SessionsListResponse>(
      "/api/draft/sessions",
      undefined,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const items = data.items ?? [];
        setSessions(items);

        if (items.length === 0) {
          setSessionId(null);
          return;
        }

        // activeDraftSessionId 가 유효한 소유 세션이면 최우선.
        const activeId = getActiveDraftSessionId();
        if (activeId !== null && items.some((s) => s.id === activeId)) {
          setSessionId(activeId);
          const next = new URLSearchParams(searchParams);
          next.set("sessionId", String(activeId));
          setSearchParams(next, { replace: true });
          return;
        }

        // 활성 드래프트가 없으면 URL 만 신뢰. 옛 stale URL 이라도 그 값이
        // 소유 세션이면 그대로 두고 (북마크/공유 시나리오), 아니면 빈 상태.
        const urlIdNum = urlSessionIdRaw ? Number(urlSessionIdRaw) : NaN;
        const urlIsValid =
          Number.isFinite(urlIdNum) && items.some((s) => s.id === urlIdNum);
        if (urlIsValid) {
          setSessionId(urlIdNum);
        } else {
          setSessionId(null);
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
    // 마운트 시 한 번만 — URL/searchParams 가 바뀌어도 재조회하지 않음
    // (URL 변경은 setSearchParams 로 우리가 직접 만든 결과)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2단계: sessionId 가 결정되면 해당 세션의 My Team 데이터 로드 ──
  useEffect(() => {
    if (sessionId === null) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiGetAuth<MyTeamPlayersResponse>(
      "/api/my-team/players",
      { sessionId },
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return;
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
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [sessionId]);

  // 현재 보고 있는 세션의 메타 정보 (제목 옆에 이름 표시용)
  const activeSession = useMemo(
    () => sessions?.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );

  // 세션 0개 빈 상태 (sessions 로드 완료 + length === 0)
  const noSessions = sessions !== null && sessions.length === 0;
  // 세션은 있지만 지금 보고 있을 활성 드래프트가 없음 (Draft 페이지에서 New/Discard
  // 후, 또는 처음 들어왔는데 URL/active 세션 없음). 옛 세션을 자동으로
  // 끌어오지 않고 명시적 안내 — "마이팀 = 현재 드래프트" 시맨틱 유지.
  const noActiveDraft =
    sessions !== null && sessions.length > 0 && sessionId === null;
  const sessionsLoading = sessions === null && sessionsError === null;

  // 클라이언트 측 필터링 + 정렬 (백엔드 재호출 없이 메모리에서 계산)
  const visiblePlayers = useMemo(
    () => sortMyTeam(filterMyTeam(players, query, pos), sort),
    [players, query, pos, sort]
  );

  return (
    <div className="space-y-6">
      {/* 상단: 제목 + 예산 카드 */}
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

      {/* 세션 0개일 때: 안내 카드만 보여주고 본문 테이블은 렌더하지 않음 */}
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

      {/* 세션은 있지만 현재 활성 드래프트가 없음 (New/Discard 직후 등) */}
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

      {/* 세션 목록 조회 자체가 실패 */}
      {sessionsError && (
        <FadeIn delayMs={60}>
          <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-200">
            Failed to load draft sessions: {sessionsError}
          </section>
        </FadeIn>
      )}

      {/* 본문: 검색/정렬/포지션 필터 + 선수 목록 테이블 */}
      {!noSessions && !noActiveDraft && !sessionsError && (
      <FadeIn delayMs={60} className="relative z-40">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          {/* 검색창 + 정렬 드롭다운 */}
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

          {/* 포지션 필터 칩 */}
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

          {/* 선수 목록 테이블 */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            {/* 테이블 헤더 */}
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

            {/* 테이블 본문: 로딩/에러/빈 상태/정상 4가지 분기 */}
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
                  {/* 선수 이름 (클릭 시 모달) */}
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

                  {/* 포지션 배지 */}
                  <div>
                    <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white/80">
                      {player.pos}
                    </span>
                  </div>

                  {/* 드래프트 비용 */}
                  <div className="font-semibold text-white/80">{player.cost}</div>

                  {/* MLB 팀 배지 (팀별 색상) */}
                  <div>
                    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-extrabold ${mlbTeamBadgeClass(player.team)}`}>
                      {player.team}
                    </span>
                  </div>

                  {/* 스탯 */}
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

                  {/* PPA-DUN 가치 점수 (10점 이상이면 발광 효과) */}
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

      {/* 선수 정보 모달 */}
      <PlayerInfoModal
        open={profilePlayerId !== null}
        playerId={profilePlayerId}
        playerType={profilePlayerType}
        onClose={() => setProfilePlayerId(null)}
      />
    </div>
  );
}
