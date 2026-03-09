import { useSyncExternalStore } from "react";
import { API_BASE_URL } from "./api";
import { DRAFT_ROOM_ID } from "./runtimeConfig";

export const TOKEN_KEY = "ppadun_token";

const DRAFT_RESET_PATH = `/api/draft/picks?roomId=${encodeURIComponent(DRAFT_ROOM_ID)}`;
const DRAFT_RESET_URL = API_BASE_URL ? `${API_BASE_URL}${DRAFT_RESET_PATH}` : DRAFT_RESET_PATH;

/** Read current auth state */
export function isAuthed(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

/** --- Reactive auth store --- */
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(e: StorageEvent) {
  if (e.key === TOKEN_KEY) emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);

  // Attach storage listener once the first subscriber exists.
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Hook: components re-render when auth changes */
export function useAuth(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isAuthed(),
    () => false
  );
}

/** Mutations */
export function mockLogin(): void {
  localStorage.setItem(TOKEN_KEY, "mock-token");
  emit();
}

export function logout(): void {
  void fetch(DRAFT_RESET_URL, { method: "DELETE" }).catch(() => {
    // Ignore reset failures during logout to avoid blocking auth state update.
  });
  localStorage.removeItem(TOKEN_KEY);
  emit();
}

// Will be substituted with a real login API call in the future.
