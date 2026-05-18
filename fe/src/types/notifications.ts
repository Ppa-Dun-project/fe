/**
 * NotificationEvent: backend의 GET /api/notifications/recent 응답 items 요소.
 *
 * - 부상/뎁스 변경 자동 감지 또는 admin이 보낸 fake push로 생성됨
 * - id 오름차순 정렬로 도착. FE는 마지막으로 본 id를 localStorage에 보관해
 *   재접속 시 그 이후 알림만 catch-up 한다.
 */
export type NotificationEvent = {
  id: number;
  event_type: string;          // "INJURY" | "DEPTH" | "NEWS" etc
  player_id: string;
  player_name: string | null;
  message: string;
  created_at: string;          // ISO 8601
};
