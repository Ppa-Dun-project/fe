import { Navigate, Outlet, useLocation } from "react-router-dom";

function isLoggedIn(): boolean {
  // MVP stub: token 있으면 로그인으로 간주
  return Boolean(localStorage.getItem("ppadun_token"));
}

export default function ProtectedRoute() {
  const location = useLocation();
  const authed = isLoggedIn();

  if (!authed) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}