import { useNavigate, useSearchParams } from "react-router-dom";
import { mockLogin } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const redirect = params.get("redirect")
    ? decodeURIComponent(params.get("redirect") as string)
    : "/my-team";

  const onMockLogin = () => {
    mockLogin();
    navigate(redirect, { replace: true });
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
          AUTH • MVP STUB
        </div>

        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">
          Login
        </h1>
        <p className="mt-2 text-sm text-white/70">
          This is a temporary mock login. It sets a token in localStorage and
          returns you to the page you wanted.
        </p>

        <button
          onClick={onMockLogin}
          className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:translate-y-[-1px] hover:bg-white/90 active:translate-y-0"
        >
          Mock Login
        </button>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Redirect after login</div>
          <div className="mt-1 break-all font-mono text-xs text-white/80">
            {redirect}
          </div>
        </div>
      </div>
    </div>
  );
}