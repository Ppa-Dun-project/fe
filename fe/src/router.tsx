import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import PlayersPage from "./pages/PlayersPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";
import SettingsPage from "./pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },

      { path: "players", element: <PlayersPage /> },
      { path: "players/:id", element: <PlayerDetailPage /> },

      { path: "login", element: <LoginPage /> },

      // Protected group
      {
        element: <ProtectedRoute />,
        children: [
          { path: "my-team", element: <MyTeamPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
]);