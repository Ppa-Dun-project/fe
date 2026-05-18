// useSyncExternalStore: React 18+ hook
// - Used when subscribing to an external store (localStorage, window events, etc.)
// - Automatically re-renders the component when the store changes
import { useSyncExternalStore } from "react";

// Key name used to store the token in localStorage
// - Accessed via localStorage.getItem("ppadun_token")
export const TOKEN_KEY = "ppadun_JWT_token";

/**
 * Base64url-decodes the JWT payload (the middle segment) and returns it as an object.
 * - Returns null if the format is malformed or decoding fails (callers treat this as expired).
 * - JWT's base64url replaces "+/" with "-_" and omits "=" padding, so we have to restore those.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Checks the JWT's exp (expiry time, epoch seconds) and returns whether it's expired.
 * - If exp is missing or decoding fails, treat as expired (true) — safe-side fallback.
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return true;
  return exp * 1000 <= Date.now();
}

/**
 * Pulls the JWT out of localStorage, but if it's expired we remove it
 * immediately and return null.
 * - Strengthens the auth model from "has a token → signed in" to "has a valid, unexpired token → signed in".
 * - Cleans up on the client before a stale token hits a protected API and earns a 401.
 */
function getValidStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  return token;
}

/**
 * Returns whether the user is currently signed in.
 * - True only when a token exists and is not expired.
 */
export function isAuthed(): boolean {
  return Boolean(getValidStoredToken());
}

// ── Pub/Sub-based auth state management ──
// On login/logout, notify every subscriber (component) so they re-render automatically.

// Listener: type of a notification callback (no args, no return value)
type Listener = () => void;

// Set: a deduped collection (prevents registering the same listener twice)
const listeners = new Set<Listener>();

/**
 * emit: notify every subscriber that "auth state has changed".
 * - for...of: syntax for iterating an array/Set.
 */
function emit() {
  for (const listener of listeners) listener();
}

/**
 * onStorage: detect localStorage changes coming from other browser tabs.
 * - StorageEvent: the event the browser fires when localStorage changes.
 * - It does NOT fire in the same tab that made the change — only in other tabs.
 */
function onStorage(e: StorageEvent) {
  // Only notify when our token key changed
  if (e.key === TOKEN_KEY) emit();
}

/**
 * subscribe: lets React components subscribe to auth state changes.
 * - Used as the first argument to useSyncExternalStore.
 * - Returns an unsubscribe function (React calls it automatically on unmount).
 */
function subscribe(listener: Listener) {
  listeners.add(listener);

  // Register the storage event listener only when the first subscriber appears (efficiency)
  if (listeners.size === 1) window.addEventListener("storage", onStorage);

  // Return the unsubscribe function
  return () => {
    listeners.delete(listener);
    // Remove the event listener once the last subscriber is gone (saves memory)
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * useAuth: React hook that tracks sign-in state in real time.
 * - Use as `const authed = useAuth()` inside a component.
 * - Components automatically re-render on login/logout.
 *
 * useSyncExternalStore's three arguments:
 * 1. subscribe: the subscription function.
 * 2. getSnapshot: returns the current state (client).
 * 3. getServerSnapshot: default value during server rendering (SSR support).
 */
export function useAuth(): boolean {
  return useSyncExternalStore(subscribe, () => isAuthed(), () => false);
}

/**
 * getAccessToken: returns a valid JWT token.
 * - Returns null when the token is missing or expired (treated as unauthenticated).
 * - Expired tokens are automatically removed from localStorage at call time.
 * - Used by api.ts when assembling the Authorization header.
 */
export function getAccessToken(): string | null {
  return getValidStoredToken();
}

/**
 * login: sign-in — stores the token and notifies every subscriber.
 */
export function login(token: string): void {
  // localStorage.setItem: persists data in the browser store (survives tab close)
  localStorage.setItem(TOKEN_KEY, token);
  emit();  // Every useAuth() hook re-renders
}

/**
 * logout: sign-out.
 * 1. Remove the token from localStorage.
 * 2. Notify every subscriber.
 *
 * Does NOT touch the database — draft state must be restorable when the user signs back in.
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  emit();
}
