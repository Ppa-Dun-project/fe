// useNavigate: function for page navigation
// useSearchParams: hook for reading URL query parameters (?foo=bar)
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
// Shared Google OAuth hook
import { useGoogleSignIn } from "../lib/googleAuth";

/**
 * LoginPage: dedicated login page (/login)
 * - Reads the URL ?redirect parameter and returns to that page after login
 * - Displays an error message when the ?error parameter is present
 */
export default function LoginPage() {
  const navigate = useNavigate();
  // useSearchParams: returns [current params, setter for params]
  const [params] = useSearchParams();

  // URL error parameter (e.g. /login?error=unauthorized)
  const urlError = params.get("error");
  // Runtime auth error (when Google sign-in fails)
  const [authError, setAuthError] = useState<string | null>(null);

  // Read and decode the redirect parameter (defaults to "/" if absent)
  // decodeURIComponent: the inverse of encodeURIComponent (restores the original string)
  const redirect = params.get("redirect")
    ? decodeURIComponent(params.get("redirect") as string)
    : "/";

  // useGoogleSignIn: renders the Google sign-in button and handles the auth flow
  // - onSuccess: runs on successful login (replace: true → prevents going back to the login page)
  // - onError: receives the error message on failure and surfaces it in the UI
  const buttonRef = useGoogleSignIn(
    () => {
      setAuthError(null);
      navigate(redirect, { replace: true });
    },
    (msg) => setAuthError(msg),
  );

  const error = authError ?? urlError;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
          AUTH
        </div>

        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">Login</h1>
        <p className="mt-2 text-sm text-white/70">
          Sign in with your Google account to access all features.
        </p>

        {/* Display a red alert box when an error is present */}
        {/* && operator: renders the trailing JSX only when error is truthy */}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Login failed: {error}
          </div>
        )}

        {/* The Google sign-in button gets rendered here (useGoogleSignIn handles it) */}
        <div ref={buttonRef} className="mt-6 w-full opacity-85 transition hover:opacity-100" />
      </div>
    </div>
  );
}
