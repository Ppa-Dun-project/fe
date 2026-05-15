// 15초마다 백엔드 알림 폴링하는 훅.
//
// 동작:
// 1. 마운트 시 첫 호출 응답의 latest_id 로 lastSeen을 맞춤 → 그 시점 이전의 모든
//    알림은 무시 (토스트 안 띄움).
// 2. 그 이후 polling은 since=lastSeen 으로 새로 들어온 알림만 받아 onEvent 호출.
//
// localStorage catch-up은 의도적으로 안 함 — 사용자가 자는 동안 쌓인 알림을
// 깨어나서 한꺼번에 토스트로 받는 게 오히려 불편하다는 피드백 반영.
import { useEffect, useRef } from "react";

import { apiGetAuth } from "../lib/api";
import type { NotificationEvent } from "../types/notifications";

const POLL_INTERVAL_MS = 15_000;
const FETCH_LIMIT = 50;

type Response = {
  items: NotificationEvent[];
  latest_id: number;
};

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
    let lastSeenId: number | null = null;

    const tick = async () => {
      try {
        const data = await apiGetAuth<Response>(
          "/api/notifications/recent",
          { since: lastSeenId ?? 0, limit: FETCH_LIMIT }
        );
        if (cancelled) return;

        // 첫 호출: latest_id로 시작점 잡음, items는 무시.
        if (lastSeenId === null) {
          lastSeenId = data.latest_id;
          return;
        }

        const items = data.items ?? [];
        if (items.length === 0) return;

        for (const ev of items) {
          onEventRef.current(ev);
          if (ev.id > lastSeenId) lastSeenId = ev.id;
        }
      } catch (err) {
        // 401, 5xx, 네트워크 끊김 등 — 다음 tick에 재시도하므로 조용히 처리.
        if (!cancelled) console.warn("notification polling failed:", err);
      }
    };

    tick(); // 마운트 시 즉시 한 번 (lastSeen 초기화)
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
