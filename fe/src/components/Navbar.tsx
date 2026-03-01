import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { isAuthed, logout } from "../lib/auth";
import { useMemo, useState } from "react";
import logo from "../assets/LOGO.png"; // Team Black's LOGO

function cxLink(isActive: boolean) {
  return [
    "px-3 py-2 rounded-lg text-sm transition",
    isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white hover:bg-white/5",
  ].join(" ");
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = isAuthed();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const redirectToLogin = () => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  };

  const menu = useMemo(() => {
    const base = [
      { to: "/", label: "Home", protected: false },
      { to: "/players", label: "Players", protected: false }, // standing/leaders 
    ];

    const protectedItems = [
      { to: "/my-team", label: "My Team", protected: true },
      { to: "/settings", label: "Settings", protected: true },
    ];

    return authed ? [...base, ...protectedItems] : base;
  }, [authed]);

  const onClickNav = (to: string, isProtected: boolean) => {
    setDrawerOpen(false);
    if (isProtected && !authed) return redirectToLogin();
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left: Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 transition"
        >
          <img
            src={logo}
            alt="Black Team Logo"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="text-white font-semibold tracking-wide">Black</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cxLink(isActive)}
              onClick={(e) => {
                // Protected UX: 게스트가 protected 클릭하면 login으로
                if (item.protected && !authed) {
                  e.preventDefault();
                  redirectToLogin();
                }
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="hidden items-center gap-3 md:flex">
          {!authed ? (
            <button
              onClick={() => navigate("/login")}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:translate-y-[-1px] hover:bg-white/90 active:translate-y-0"
            >
              Login
            </button>
          ) : (
            <>
              <span className="text-sm text-white/70">User</span>
              <button
                onClick={() => {
                  logout();
                  navigate("/", { replace: true });
                }}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                Logout
              </button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-xl border border-white/10 px-3 py-2 text-white/90 hover:bg-white/5 transition"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close overlay"
          />
          <div className="absolute right-0 top-0 h-full w-[82%] max-w-sm border-l border-white/10 bg-zinc-950 p-4 animate-drawerIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg" />
                <span className="text-white font-semibold">Black</span>
              </div>
              <button
                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5 transition"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {/* show protected items too, but clicking them redirects to login if guest */}
              {[
                { to: "/", label: "Home", protected: false },
                { to: "/players", label: "Players", protected: false },
                { to: "/my-team", label: "My Team", protected: true },
                { to: "/settings", label: "Settings", protected: true },
              ].map((item) => (
                <button
                  key={item.to}
                  onClick={() => onClickNav(item.to, item.protected)}
                  className="w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-white/90 hover:bg-white/5 transition"
                >
                  {item.label}
                  {item.protected && !authed && (
                    <span className="ml-2 text-xs text-white/50">(login)</span>
                  )}
                </button>
              ))}

              <div className="mt-4 border-t border-white/10 pt-4">
                {!authed ? (
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate("/login");
                    }}
                    className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Login
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      logout();
                      setDrawerOpen(false);
                      navigate("/", { replace: true });
                    }}
                    className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/5 transition"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}