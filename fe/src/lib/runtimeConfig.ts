/**
 * readEnvValue: Helper to safely read an environment variable.
 * - If a value is present, trim whitespace and return it.
 * - If the value is missing or an empty string, return the fallback default.
 *
 * rawValue?.trim(): optional chaining
 * - If rawValue is undefined, returns undefined (no error thrown).
 * - If rawValue exists, calls trim() on it.
 */
function readEnvValue(rawValue: string | undefined, fallback: string) {
  const trimmed = rawValue?.trim();
  // Ternary operator: use trimmed if truthy, otherwise the fallback.
  return trimmed ? trimmed : fallback;
}

// Draft room ID — identifies which draft room the data belongs to.
// - Can be set via VITE_DRAFT_ROOM_ID=... in .env
// - Defaults to "default" when not set.
export const DRAFT_ROOM_ID = readEnvValue(import.meta.env.VITE_DRAFT_ROOM_ID, "default");

// My team ID — identifies my team when calling the API.
export const MY_TEAM_ID = readEnvValue(import.meta.env.VITE_MY_TEAM_ID, "team-0");
