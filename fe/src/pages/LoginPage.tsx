import { useNavigate, useSearchParams } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") ? decodeURIComponent(params.get("redirect")!) : "/my-team";

  const onMockLogin = () => {
    // MVP stub: 로그인 성공했다고 치고 토큰 저장
    localStorage.setItem("ppadun_token", "mock-token");
    navigate(redirect, { replace: true });
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-bold">Login</h1>
      <p className="mt-2 text-sm text-gray-600">
        This is a stub login. Click to set a mock token.
      </p>

      <button
        onClick={onMockLogin}
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
      >
        Mock Login
      </button>

      <p className="mt-3 text-xs text-gray-500">
        Redirect after login: <span className="font-mono">{redirect}</span>
      </p>
    </div>
  );
}