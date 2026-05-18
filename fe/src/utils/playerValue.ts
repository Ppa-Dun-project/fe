// Shared utilities for displaying PPA-DUN values.
// - Previously, .toFixed(1) calls and style branching were scattered across each page/modal.
// - Consolidates the formatter and styler into a single source so display policy lives in one place.

/** Format a PPA-DUN value to one decimal place. Returns "—" if missing or non-finite. */
export function formatPpa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

/**
 * Tailwind classes to apply to a PPA-DUN value.
 * - Unauthenticated: blur + dim color (mask paid information).
 * - 10 or higher: emerald glow effect (highlight).
 * - Otherwise: default emerald.
 *
 * value accepts number | null | undefined — safe even before auth or when value lookup fails.
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
