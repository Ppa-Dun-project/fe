// PPA-DUN 값 표시를 위한 공통 유틸
// - 이전에는 각 페이지/모달마다 .toFixed(1)과 스타일 분기가 흩어져 있었음
// - 포매터와 스타일러를 단일 소스로 통합해 표시 정책을 한 곳에서 관리

/** PPA-DUN 값을 소수 1자리로 포맷. 없거나 유한수가 아니면 "—" 반환. */
export function formatPpa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

/**
 * PPA-DUN 값에 적용할 Tailwind 클래스.
 * - 비로그인: 블러 + 흐린 색 (유료 정보 마스킹)
 * - 10점 이상: 에메랄드 발광 효과 (하이라이트)
 * - 그 외: 기본 에메랄드
 *
 * value 는 number | null | undefined 를 모두 허용 — 인증 전/값 조회 실패 시에도 안전.
 */
export function ppaValueClass(
  value: number | null | undefined,
  opts?: { authed?: boolean }
): string {
  const authed = opts?.authed ?? true;
  if (!authed) return "blur-sm select-none text-emerald-400/60";
  if (typeof value === "number" && value >= 10) {
    return "text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.55)]";
  }
  return "text-emerald-400";
}
