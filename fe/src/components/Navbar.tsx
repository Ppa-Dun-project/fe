import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { logout as doLogout, useAuth } from "../lib/auth";
import { useMemo, useState } from "react";
import logo from "../assets/LOGO.png";

function navItemClass(isActive: boolean) {
  return [
    "px-3 py-2 rounded-xl text-base font-black tracking-wide transition",
    isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white hover:bg-white/5",
  ].join(" ");
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const redirectToLogin = () => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  };

  const menu = useMemo(() => {
    const base = [
      { to: "/", label: "Home", protected: false },
      { to: "/draft", label: "Draft", protected: false },
    ];
    const protectedItems = [{ to: "/my-team", label: "My Team", protected: true }];
    return authed ? [...base, ...protectedItems] : base;
  }, [authed]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto w-full max-w-[1400px] px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => {
              setDrawerOpen(false);
              navigate("/");
            }}
            className="group flex items-center gap-3 rounded-2xl border border-transparent bg-white/[0.02] p-1.5 transition hover:border-white/30 hover:bg-white/[0.09] hover:backdrop-blur-md hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_0_1px_rgba(255,255,255,0.05)]"
            aria-label="Go to Home"
          >
            <img
              src={logo}
              alt="Logo"
              className="h-11 w-11 rounded-2xl object-cover ring-1 ring-transparent transition group-hover:ring-white/35"
            />
            <span
              className="text-xl text-white/95 transition group-hover:text-white group-hover:[text-shadow:0_0_14px_rgba(255,255,255,0.4)]"
              style={{ fontFamily: '"Jaro", system-ui' }}
            >
              PPA-DUN
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-2 md:flex">
            {menu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => navItemClass(isActive)}
                onClick={(e) => {
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
                className="
                  rounded-2xl bg-emerald-500 px-4 py-2 text-base font-black text-black
                  shadow-[0_12px_30px_rgba(16,185,129,0.25)]
                  transition hover:translate-y-[-1px] hover:bg-emerald-400 active:translate-y-0
                "
              >
                Login
              </button>
            ) : (
              <button
                onClick={() => {
                  doLogout();
                  navigate("/", { replace: true });
                }}
                className="
                  rounded-2xl bg-emerald-500 px-4 py-2 text-base font-black text-black
                  shadow-[0_12px_30px_rgba(16,185,129,0.25)]
                  transition hover:translate-y-[-1px] hover:bg-emerald-400 active:translate-y-0
                "
              >
                Logout
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-2xl border border-white/10 px-3 py-2 text-white/90 hover:bg-white/5 transition"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[82%] max-w-sm border-l border-white/10 bg-zinc-950 p-4 animate-drawerIn">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  navigate("/");
                }}
                className="group flex items-center gap-2 rounded-2xl border border-transparent bg-white/[0.02] p-1.5 transition hover:border-white/30 hover:bg-white/[0.09] hover:backdrop-blur-md"
              >
                <img
                  src={logo}
                  alt="Logo"
                  className="h-10 w-10 rounded-2xl object-cover ring-1 ring-transparent transition group-hover:ring-white/35"
                />
                <span
                  className="text-lg text-white/95 transition group-hover:text-white group-hover:[text-shadow:0_0_14px_rgba(255,255,255,0.35)]"
                  style={{ fontFamily: '"Jaro", system-ui' }}
                >
                  PPA-DUN
                </span>
              </button>

              <button
                className="rounded-xl border border-white/10 px-3 py-1 text-xs font-black text-white/80 hover:bg-white/5 transition"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {[
                { to: "/", label: "Home", protected: false },
                { to: "/draft", label: "Draft", protected: false },
                { to: "/my-team", label: "My Team", protected: true },
              ].map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    if (item.protected && !authed) return redirectToLogin();
                    setDrawerOpen(false);
                    navigate(item.to);
                  }}
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 text-left text-base font-black text-white/90 hover:bg-white/5 transition"
                >
                  {item.label}
                </button>
              ))}

              <div className="mt-4 border-t border-white/10 pt-4">
                {!authed ? (
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate("/login");
                    }}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-base font-black text-black transition hover:bg-emerald-400"
                  >
                    Login
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      doLogout();
                      setDrawerOpen(false);
                      navigate("/", { replace: true });
                    }}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-base font-black text-black transition hover:bg-emerald-400"
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
