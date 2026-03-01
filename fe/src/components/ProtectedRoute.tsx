import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthed } from "../lib/auth";

export default function ProtectedRoute() {
  const location = useLocation();
  const authed = isAuthed();

  if (!authed) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}