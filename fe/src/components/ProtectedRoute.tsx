// Navigate: redirect component (navigates to another URL when rendered)
// Outlet: placeholder where child routes are rendered
// useLocation: hook that returns the current URL info
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthed } from "../lib/auth";

/**
 * ProtectedRoute: guard that wraps pages requiring authentication.
 * - Unauthenticated users are redirected to /login automatically.
 * - Saves the originally intended URL as a redirect param so the user
 *   returns to it after signing in.
 *
 * Example (router.tsx):
 *   {
 *     element: <ProtectedRoute />,
 *     children: [{ path: "my-team", element: <MyTeamPage /> }]
 *   }
 */
export default function ProtectedRoute() {
  // Current URL info (path + query string)
  // - pathname: "/my-team"
  // - search: "?foo=bar" (if present)
  const location = useLocation();

  // Check auth state
  if (!isAuthed()) {
    // Save the URL we want to return to after login as a query param
    // - encodeURIComponent: escapes special characters for safe URL use
    const redirect = encodeURIComponent(location.pathname + location.search);

    // replace: redirect without pushing a new history entry
    // - prevents an infinite loop when the user hits Back
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // When authenticated, render the child route (e.g. MyTeamPage) normally
  return <Outlet />;
}
