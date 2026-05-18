/**
 * timeAgo: converts an ISO time string into a relative time like "3h ago"
 *
 * Examples:
 *   timeAgo("2026-04-17T10:00:00Z") → "3h ago"
 *   timeAgo(yesterday) → "1d ago"
 *
 * Behavior:
 * 1. Convert the ISO string into a Date object → extract a millisecond timestamp
 * 2. Compute the difference from the current time
 * 3. Display in the appropriate unit (minutes / hours / days)
 */
export function timeAgo(iso: string): string {
  // new Date(iso).getTime(): ISO string → millisecond timestamp
  // Date.now(): current timestamp
  const diff = Date.now() - new Date(iso).getTime();

  // Math.floor: rounds down (e.g., 3.7 → 3)
  // 60000: 1 minute = 60 seconds × 1000 milliseconds
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "just now";          // less than 1 minute
  if (mins < 60) return `${mins}m ago`;     // less than 60 minutes

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;   // less than 24 hours

  // 24 hours or more is displayed in days
  return `${Math.floor(hours / 24)}d ago`;
}
