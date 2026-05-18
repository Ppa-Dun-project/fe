// React Router hooks
// - NavLink: similar to Link, but automatically applies an 'active' style when its URL matches
// - useLocation: returns the current URL
// - useNavigate: returns a function for programmatic page navigation
import { NavLink, useLocation, useNavigate } from "react-router-dom";
// Import the logout function and the auth-status hook (aliased as doLogout to avoid name collisions)
import { logout as doLogout, useAuth } from "../lib/auth";
// useMemo: caches a computed value (re-runs only when its dependencies change)
// useState: manages component-local state
import { useMemo, useState } from "react";
import logo from "../assets/LOGO.png";

/**
 * navItemClass: decides the active/inactive style for a nav link
 * - isActive: whether the link matches the current URL
 */
function navItemClass(isActive: boolean) {
  return [
    "px-3 py-2 rounded-xl text-base font-black tracking-wide transition",
    // Emphasize background when active, otherwise show background only on hover
    isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white hover:bg-white/5",
  ].join(" ");
}

/**
 * Navbar: top navigation bar
 * - Desktop: horizontal menu + login/logout button
 * - Mobile: hamburger menu → opens as a drawer (side panel)
 * - The menu items and buttons change dynamically based on auth state
 */
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  // Tracks the auth state in real time (automatically re-renders on login/logout)
  const authed = useAuth();
  // Mobile drawer open/closed state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigate to the login page, saving the current URL as the redirect parameter
  const redirectToLogin = () => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  };

  // useMemo: computes the menu array based on auth state (recomputes only when authed changes)
  const menu = useMemo(() => {
    const base = [
      { to: "/", label: "Home", protected: false },
      { to: "/draft", label: "Draft", protected: false },
    ];
    const protectedItems = [{ to: "/my-team", label: "My Team", protected: true }];
    // Spread operator (...): expands arrays and concatenates them
    return authed ? [...base, ...protectedItems] : base;
  }, [authed]);

  return (
    // sticky top-0: pinned to the top even when scrolling
    // z-40: displayed above other elements
    // backdrop-blur: blurs the content behind it (glass effect)
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto w-full max-w-[1400px] px-8 py-3">
        <div className="flex items-center justify-between">
          {/* ── Logo + brand name (clicking navigates home) ── */}
          <button
            onClick={() => {
              setDrawerOpen(false);  // Close the drawer
              navigate("/");          // Navigate home
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

          {/* ── Desktop navigation (visible at md and above) ── */}
          {/* hidden md:flex: hidden by default, shown only on medium screens and up */}
          <nav className="hidden items-center gap-2 md:flex">
            {menu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                // Pass className as a function → NavLink supplies the isActive flag
                className={({ isActive }) => navItemClass(isActive)}
                onClick={(e) => {
                  // For a protected menu item with no login, block navigation and go to the login page
                  if (item.protected && !authed) {
                    e.preventDefault();  // Cancel the default navigation
                    redirectToLogin();
                  }
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* ── Desktop login/logout button ── */}
          <div className="hidden items-center gap-3 md:flex">
            {!authed ? (
              // Logged out: Login button
              <button
                onClick={() => navigate("/login")}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-base font-black text-black shadow-[0_12px_30px_rgba(16,185,129,0.25)] transition hover:translate-y-[-1px] hover:bg-emerald-400 active:translate-y-0"
              >
                Login
              </button>
            ) : (
              // Logged in: Logout button
              <button
                onClick={() => {
                  doLogout();                          // Clear tokens + reset the backend
                  navigate("/", { replace: true });    // Navigate home (replace history entry)
                }}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-base font-black text-black shadow-[0_12px_30px_rgba(16,185,129,0.25)] transition hover:translate-y-[-1px] hover:bg-emerald-400 active:translate-y-0"
              >
                Logout
              </button>
            )}
          </div>

          {/* ── Mobile hamburger menu button (visible below md) ── */}
          <button
            className="md:hidden rounded-2xl border border-white/10 px-3 py-2 text-white/90 hover:bg-white/5 transition"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* ── Mobile drawer (appears when the hamburger is clicked) ── */}
      {/* Conditional rendering: only rendered when drawerOpen is true */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Background overlay (clicking closes the drawer) */}
          <button className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />

          {/* Drawer body (slides in from the right) */}
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

            {/* Drawer menu items */}
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

              {/* Login/logout button at the bottom of the drawer */}
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
