// Import the core React Router functions/components
// - createBrowserRouter: creates a URL-based router (uses the History API)
// - Navigate: declarative redirect component (navigates to another URL)
import { createBrowserRouter, Navigate } from "react-router-dom";

// Shared layout — wraps the Navbar plus page content
import AppLayout from "./components/AppLayout";
// Guard component that wraps pages requiring login
import ProtectedRoute from "./components/ProtectedRoute";

// Import the page components that correspond to each URL
import HomePage from "./pages/HomePage";
import DraftPage from "./pages/DraftPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import NewsPage from "./pages/NewsPage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";

// router: the central config mapping URLs to pages
// - Routes are defined as an array
// - Supports a nested structure (children), making it easy to share a common layout
export const router = createBrowserRouter([
  {
    path: "/",                    // Root path
    element: <AppLayout />,       // Wraps all child pages in this layout
    children: [
      // index: true → the page rendered when the path is exactly "/"
      { index: true, element: <HomePage /> },

      // Map each URL to its page
      { path: "news", element: <NewsPage /> },

      // Unsaved draft mode: uses the ppadun_unsaved_draft entry in sessionStorage
      { path: "draft", element: <DraftPage /> },
      // Saved session mode: reloads the SessionDetail from the server
      { path: "draft/:sessionId", element: <DraftPage /> },

      // Player detail page — served directly at /players/:id to avoid clashing with sessionId
      { path: "players/:id", element: <PlayerDetailPage /> },

      { path: "login", element: <LoginPage /> },

      // ── Legacy URL compatibility redirects ──
      { path: "players", element: <Navigate to="/draft" replace /> },
      { path: "settings", element: <Navigate to="/my-team" replace /> },

      // ── Pages that require login ──
      // Wrapping with ProtectedRoute auto-redirects unauthenticated users to /login
      {
        element: <ProtectedRoute />,
        children: [{ path: "my-team", element: <MyTeamPage /> }],
      },
    ],
  },
]);
