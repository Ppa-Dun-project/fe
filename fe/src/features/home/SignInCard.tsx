import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../../assets/LOGO.png";
import { useGoogleSignIn } from "../../lib/googleAuth";

export default function SignInCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);

  const buttonRef = useGoogleSignIn(
    () => {
      setAuthError(null);
      const redirect = location.pathname + location.search;
      navigate(redirect === "/login" ? "/" : redirect, { replace: true });
    },
    (msg) => setAuthError(msg),
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col items-center text-center">
        <div className="h-16 w-16 overflow-hidden rounded-3xl bg-white/10 p-2">
          <img src={logo} alt="PPA-Dun logo" className="h-full w-full object-cover" />
        </div>

        <div className="mt-4 text-sm font-black text-white">PPA-DUN</div>

        <div className="mt-6 text-lg font-black text-white">Sign in to get started</div>
        <div className="mt-2 text-xs text-white/55">
          Draft players, track your team, and win.
        </div>

        <div ref={buttonRef} className="mt-6 w-full opacity-85 transition hover:opacity-100" />

        {authError && (
          <div className="mt-3 w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {authError}
          </div>
        )}

        <div className="mt-8 w-full border-t border-white/10 pt-6 text-left">
          <div className="text-xs font-black text-white/70">What you get with PPA-DUN:</div>
          <ul className="mt-3 space-y-2 text-xs text-white/65">
            <li>AI-powered player valuations</li>
            <li>Live draft with budget tracking</li>
            <li>Daily news & injury reports</li>
            <li>Roster optimization tools</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
