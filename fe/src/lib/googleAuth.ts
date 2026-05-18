// React hook imports
// - useCallback: memoizes a function (avoids unnecessary re-creation)
// - useEffect: handles component lifecycle (mount/unmount, etc.)
// - useRef: stores a reference to a DOM element (a value that doesn't drive re-renders)
import { useCallback, useEffect, useRef } from "react";
import { apiPost } from "./api";
import { login } from "./auth";

// Google OAuth client ID — injected via an environment variable (can differ per environment)
// VITE_GOOGLE_CLIENT_ID must be set in .env.development / .env.production.
const RAW_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

if (!RAW_GOOGLE_CLIENT_ID) {
  // Fail fast at build/runtime so misconfigured environments are caught early
  throw new Error(
    "VITE_GOOGLE_CLIENT_ID is not set. Add it to your .env file."
  );
}

// We threw above, so from here on the value is guaranteed to be a string (TS can't narrow across the throw, hence the separate const)
export const GOOGLE_CLIENT_ID: string = RAW_GOOGLE_CLIENT_ID;

// Shape of the object Google returns on a successful sign-in
export type GoogleCredentialResponse = {
  credential: string;  // Signed JWT containing the user info
};

// Shape of the response the backend returns (our DB's user info)
type AuthResponse = {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
};

// Google Identity Services button config — literal unions prevent typos
type ButtonConfig = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "small" | "medium" | "large";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;  // Google IS accepts pixel numbers only (strings like "100%" are ignored)
  locale?: string;
};

// Type of Google's global object (window.google.accounts.id)
// - The Google Identity Services script is loaded from index.html.
type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (r: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (el: HTMLElement, config: ButtonConfig) => void;
  cancel: () => void;
};

// Declare window.google globally → no need for `as unknown as` assertions every time
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

// Default styling for the Google sign-in button.
// - The width is controlled via the parent div's CSS (Google IS ignores "100%" strings).
const BUTTON_CONFIG: ButtonConfig = {
  theme: "outline",       // Outline style
  size: "large",          // Size
  text: "signin_with",    // Button text: "Sign in with Google"
  shape: "pill",          // Pill (rounded) shape
  locale: "en",           // English locale
};

// Polling interval (ms) and maximum wait time (ms) for the Google IS script to load
const SCRIPT_POLL_INTERVAL_MS = 100;
const SCRIPT_POLL_TIMEOUT_MS = 10_000;

/**
 * useGoogleSignIn: custom hook that drops Google sign-in into a component.
 *
 * Usage:
 *   const buttonRef = useGoogleSignIn(
 *     () => navigate("/"),
 *     (msg) => setError(msg),  // (optional) display an error message
 *   );
 *   return <div ref={buttonRef} />;  // ← the Google button is rendered here
 *
 * Flow:
 * 1. Attach the ref to a DOM div.
 * 2. Poll for the Google IS script to load (up to 10 seconds).
 * 3. The Google library renders the sign-in button into that div.
 * 4. User clicks the button → Google issues an ID token.
 * 5. The token is sent to the backend → verified + persisted to the DB.
 * 6. After validating the response, the token is stored in localStorage.
 * 7. onSuccess fires (typically navigation).
 * 8. onError fires on failure (you can surface a UI message).
 */
export function useGoogleSignIn(
  onSuccess: () => void,
  onError?: (message: string) => void,
) {
  // useRef<HTMLDivElement>: creates a ref typed as HTMLDivElement
  // - Initial value is null; the actual DOM div is wired up later.
  const buttonRef = useRef<HTMLDivElement>(null);

  // useCallback: only rebuilds the function when onSuccess / onError change
  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      // Send the Google token to the backend → verify + persist to DB → receive response
      apiPost<AuthResponse, { credential: string }>("/api/auth/google/verify", {
        credential: response.credential,
      })
        .then((data) => {
          // Validate the response shape — prevents accidentally storing `undefined` in localStorage.
          // (Previously, a backend error response could result in the literal "undefined" being saved as the token.)
          if (!data?.access_token || typeof data.access_token !== "string") {
            throw new Error("Invalid auth response: missing access_token");
          }
          login(data.access_token);
          onSuccess();
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Google login failed";
          console.error("Google login failed:", err);
          onError?.(message);
        });
    },
    [onSuccess, onError],
  );

  // useEffect: runs on mount and re-runs when handleCredential changes
  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    const startedAt = Date.now();
    // Capture the ref's current value in the closure → safe even if ref.current changes by cleanup time
    const containerOnMount = buttonRef.current;

    // Poll until the Google Identity Services script has loaded.
    // - Guarantees the button eventually renders even if the script hadn't arrived by mount time.
    const tryInit = () => {
      if (cancelled) return;

      const google = window.google?.accounts?.id;
      const container = buttonRef.current;

      if (!google || !container) {
        // Give up after 10 seconds (likely network block, ad blocker, etc.)
        if (Date.now() - startedAt > SCRIPT_POLL_TIMEOUT_MS) {
          const message =
            "Google Sign-In script failed to load. Check your network or ad blocker.";
          console.error(message);
          onError?.(message);
          return;
        }
        pollTimer = window.setTimeout(tryInit, SCRIPT_POLL_INTERVAL_MS);
        return;
      }

      google.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });

      // Clear and re-render the container → prevents stacking duplicate buttons when the effect re-runs
      container.innerHTML = "";
      google.renderButton(container, BUTTON_CONFIG);
    };

    tryInit();

    // cleanup: runs right before unmount or before the effect re-runs.
    // - Stops the poll, cancels any in-flight OAuth flow, and clears the button DOM.
    return () => {
      cancelled = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      window.google?.accounts?.id?.cancel();
      if (containerOnMount) containerOnMount.innerHTML = "";
    };
  }, [handleCredential, onError]);

  // Return the ref so the component can attach it to its own div
  return buttonRef;
}
