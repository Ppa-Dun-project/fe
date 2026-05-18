// Hook that polls the backend notification feed every 15 seconds.
//
// Behavior:
// 1. On mount, the first response's latest_id is used to set lastSeen → any
//    notifications that existed before that point are ignored (no toast).
// 2. Subsequent polls pass since=lastSeen so only newly arrived notifications
//    are returned, and onEvents is invoked. The new events for one cycle are
//    passed as a single array so the caller can batch them (e.g. collapse
//    into one toast). Calling the callback per-event would cause a toast flood.
//
// We deliberately skip any localStorage catch-up — feedback was that getting
// hit with a flood of toasts on wake-up (for notifications accumulated while
// the user was away) is more annoying than useful.
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
  onEvents: (evs: NotificationEvent[]) => void,
  enabled: boolean
) {
  // Keep the callback in a ref — each poll tick reads the latest callback,
  // while leaving onEvents out of the effect deps prevents the polling loop
  // from restarting on every render.
  const onEventsRef = useRef(onEvents);
  useEffect(() => {
    onEventsRef.current = onEvents;
  }, [onEvents]);

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

        // First call: anchor the starting point at latest_id and ignore items.
        if (lastSeenId === null) {
          lastSeenId = data.latest_id;
          return;
        }

        const items = data.items ?? [];
        if (items.length === 0) return;

        // Advance lastSeenId before invoking the callback — that way, even if
        // the callback throws, the same events won't reappear on the next tick.
        for (const ev of items) {
          if (ev.id > lastSeenId) lastSeenId = ev.id;
        }
        onEventsRef.current(items);
      } catch (err) {
        // 401, 5xx, network drops, etc. — the next tick will retry, so handle quietly.
        if (!cancelled) console.warn("notification polling failed:", err);
      }
    };

    tick(); // Fire immediately on mount (initializes lastSeen)
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
