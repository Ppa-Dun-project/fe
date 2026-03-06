import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import FadeIn from "../components/ui/FadeIn";
import Skeleton from "../components/ui/Skeleton";

import type { Player, PlayerSort } from "../types/player";
import type { PositionFilter } from "../features/players/mock";

import PlayersToolbar from "../features/players/components/PlayersToolbar";
import PlayerCard from "../features/players/components/PlayerCard";
import Pagination from "../features/players/components/Pagination";
import DraftSummaryBadge from "../features/players/components/DraftSummaryBadge";

function getParam(params: URLSearchParams, key: string, fallback: string) {
  return params.get(key) ?? fallback;
}




// [CHANGED] Backend base URL for players API connection.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type PlayersListResponse = {
  items: Player[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// 백엔드에 선수 목록 요청 보내는 함수
async function requestPlayers(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PlayersListResponse> {
  const res = await fetch(`${API_BASE_URL}/api/players?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as PlayersListResponse;
}

export default function DraftPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // URL state
  const query = getParam(params, "query", "");
  const position = getParam(params, "position", "ALL") as PositionFilter;
  const sort = getParam(params, "sort", "value_desc") as PlayerSort;
  const page = Number(getParam(params, "page", "1")) || 1;
  const pageSize = 8;

  // local UI state: typing buffer
  const [draftQuery, setDraftQuery] = useState(query);

  // 백엔드에서 받아온 목록 데이터.
  const [items, setItems] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [safePage, setSafePage] = useState(page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmitSearch = () => {
    const next = new URLSearchParams(params);
    next.set("query", draftQuery.trim());
    next.set("page", "1");
    setParams(next, { replace: true });
  };

  const onChangePosition = (p: PositionFilter) => {
    const next = new URLSearchParams(params);
    next.set("position", p);
    next.set("page", "1");
    setParams(next, { replace: true });
  };

  const onChangeSort = (s: PlayerSort) => {
    const next = new URLSearchParams(params);
    next.set("sort", s);
    next.set("page", "1");
    setParams(next, { replace: true });
  };

  const onChangePage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    setParams(next, { replace: true });
  };

  const onReset = () => {
    setDraftQuery("");
    setParams(new URLSearchParams(), { replace: true });
  };

  // URL의 query 값이 바뀌면, search 박스 안의 글자도 똑같이 바껴야 됨.
  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  // 검색어, 포지션, 정렬, 페이지가 바뀔 때마다 서버에 다시 요청해서 선수 목록을 받아오는 코드.
  useEffect(() => {
    const controller = new AbortController();

    const requestParams = new URLSearchParams();
    if (query.trim()) {
      requestParams.set("query", query.trim());
    }
    if (position !== "ALL") {
      requestParams.set("position", position);
    }
    requestParams.set("sort", sort);
    requestParams.set("page", String(page));
    requestParams.set("limit", String(pageSize));

    setLoading(true);
    setError(null);

    requestPlayers(requestParams, controller.signal)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setSafePage(data.page);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setItems([]);
        setTotal(0);
        setTotalPages(0);
        setSafePage(1);
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [query, position, sort, page]);
  // 위 4개 중 하나라도 바뀌면 이 함수는 다시 실행됨.

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Draft</h1>
            <p className="mt-2 text-sm text-white/60">
              Search and compare players for your auction draft. ValueScore is always visible.
            </p>
          </div>

          {/* Draft config badge (read from localStorage draft setup) */}
          <div className="lg:w-[360px]">
            <DraftSummaryBadge />
          </div>
        </div>
      </FadeIn>

      <FadeIn delayMs={60}>
        <PlayersToolbar
          query={draftQuery}
          position={position}
          sort={sort}
          onChangeQuery={setDraftQuery}
          onSubmitSearch={onSubmitSearch}
          onChangePosition={onChangePosition}
          onChangeSort={onChangeSort}
          onReset={onReset}
        />
      </FadeIn>

      <div className="grid grid-cols-1 gap-6">
        <FadeIn delayMs={120}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs font-black text-white/60">
                  Results: <span className="text-white">{total}</span>
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Click a player to view details.
                </div>
              </div>

              <div className="text-xs text-white/50">
                Showing {items.length} / {total}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              {loading && (
                <>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </>
              )}

              {!loading && error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  Failed to load draft players: {error}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  No results. Try another search or reset filters.
                </div>
              )}

              {!loading &&
                !error &&
                items.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    onClick={() => navigate(`/draft/${p.id}`)} // ✅ /players/:id → /draft/:id
                  />
                ))}
            </div>

            {!loading && !error && totalPages > 1 && (
              <Pagination page={safePage} totalPages={totalPages} onChange={onChangePage} />
            )}
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
