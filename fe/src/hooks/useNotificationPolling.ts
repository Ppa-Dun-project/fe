// 15초마다 백엔드 알림 폴링하는 훅.
// - 첫 로드 시 lastSeenId가 없으면 가장 최근 알림 id만 기억하고 토스트는 안 띄움
//   (몇 주치 알림이 한꺼번에 토스트로 폭주하는 거 방지)
// - 그 이후엔 lastSeenId 이후의 모든 알림에 대해 onEvent 콜백 호출
// - lastSeenId는 localStorage에 보관 → 페이지 닫았다 다시 열어도 catch-up
import { useEffect, useRef } from "react";

import { apiGetAuth } from "../lib/api";
import type { NotificationEvent } from "../types/notifications";

const POLL_INTERVAL_MS = 15_000;
const LAST_SEEN_KEY = "ppadun_notif_last_seen_id";
const FETCH_LIMIT = 50;

type Response = { items: NotificationEvent[] };

export function useNotificationPolling(
  onEvent: (ev: NotificationEvent) => void,
  enabled: boolean
) {
  // 콜백을 ref에 넣어둠 — 매 polling 호출이 최신 콜백을 보게 하면서도
  // effect deps에 onEvent를 안 넣어 매 렌더마다 polling 재시작되는 일 방지.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    let lastSeenId: number | null = stored !== null ? Number(stored) : null;

    const tick = async () => {
      try {
        const since = lastSeenId ?? 0;
        const data = await apiGetAuth<Response>(
          "/api/notifications/recent",
          { since, limit: FETCH_LIMIT }
        );
        if (cancelled) return;

        const items = data.items ?? [];
        if (items.length === 0) return;

        // 첫 응답이면 토스트 없이 lastSeen만 갱신 (초기 폭주 방지).
        if (lastSeenId === null) {
          const newestId = items[items.length - 1].id;
          lastSeenId = newestId;
          localStorage.setItem(LAST_SEEN_KEY, String(newestId));
          return;
        }

        // 그 이후엔 각 새 이벤트마다 콜백.
        for (const ev of items) {
          onEventRef.current(ev);
          if (ev.id > lastSeenId) lastSeenId = ev.id;
        }
        localStorage.setItem(LAST_SEEN_KEY, String(lastSeenId));
      } catch (err) {
        // 401, 5xx, 네트워크 끊김 등 — 다음 tick에 재시도하므로 조용히 처리.
        if (!cancelled) console.warn("notification polling failed:", err);
      }
    };

    tick(); // 마운트 시 즉시 한 번
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
