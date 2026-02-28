import { Link, NavLink, useNavigate } from "react-router-dom";

function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem("ppadun_token"));
}

export default function Navbar() {
  const navigate = useNavigate();
  const authed = isLoggedIn();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm ${isActive ? "font-semibold underline" : "text-gray-700 hover:text-black"}`;

  const onLogout = () => {
    localStorage.removeItem("ppadun_token");
    navigate("/", { replace: true });
  };

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <Link to="/" className="text-lg font-bold">
          PPA-Dun
        </Link>

        <nav className="flex items-center gap-4">
          <NavLink to="/" className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/players" className={linkClass}>
            Players
          </NavLink>

          {authed && (
            <>
              <NavLink to="/my-team" className={linkClass}>
                My Team
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                Settings
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {!authed ? (
            <Link
              to="/login"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Login
            </Link>
          ) : (
            <>
              <span className="text-sm text-gray-600">User</span>
              <button
                onClick={onLogout}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}