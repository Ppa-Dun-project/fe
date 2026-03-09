import { createBrowserRouter, Navigate, redirect } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import DraftPage from "./pages/DraftPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },

      // Draft
      { path: "draft", element: <DraftPage /> },
      { path: "draft/:id", element: <PlayerDetailPage /> },

      // Backward compatibility
      { path: "players", element: <Navigate to="/draft" replace /> },
      {
        path: "players/:id",
        loader: ({ params }) => redirect(params.id ? `/draft/${params.id}` : "/draft"),
      },

      { path: "login", element: <LoginPage /> },

      {
        element: <ProtectedRoute />,
        children: [{ path: "my-team", element: <MyTeamPage /> }],
      },

      { path: "settings", element: <Navigate to="/my-team" replace /> },
    ],
  },
]);
