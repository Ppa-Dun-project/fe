// useNavigate: 페이지 이동 함수
// useSearchParams: URL의 쿼리 파라미터(?foo=bar)를 읽는 훅
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
// Google OAuth 공통 훅
import { useGoogleSignIn } from "../lib/googleAuth";

/**
 * LoginPage: 로그인 전용 페이지 (/login)
 * - URL의 ?redirect 파라미터를 읽어서 로그인 후 그 페이지로 돌아감
 * - ?error 파라미터가 있으면 에러 메시지 표시
 */
export default function LoginPage() {
  const navigate = useNavigate();
  // useSearchParams: [현재 파라미터, 파라미터 변경 함수] 반환
  const [params] = useSearchParams();

  // URL 에러 파라미터 (예: /login?error=unauthorized)
  const urlError = params.get("error");
  // 런타임 인증 에러 (Google 로그인 실패 시)
  const [authError, setAuthError] = useState<string | null>(null);

  // redirect 파라미터 읽고 디코딩 (없으면 기본값 "/")
  // decodeURIComponent: encodeURIComponent의 반대 (복원)
  const redirect = params.get("redirect")
    ? decodeURIComponent(params.get("redirect") as string)
    : "/";

  // useGoogleSignIn: Google 로그인 버튼을 렌더링하고 인증 흐름 처리
  // - onSuccess: 로그인 성공 시 실행 (replace: true → 뒤로가기로 로그인 페이지 복귀 방지)
  // - onError: 실패 시 에러 메시지 받아 UI 표시
  const buttonRef = useGoogleSignIn(
    () => {
      setAuthError(null);
      navigate(redirect, { replace: true });
    },
    (msg) => setAuthError(msg),
  );

  const error = authError ?? urlError;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
          AUTH
        </div>

        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">Login</h1>
        <p className="mt-2 text-sm text-white/70">
          Sign in with your Google account to access all features.
        </p>

        {/* 에러가 있으면 빨간색 알림 박스 표시 */}
        {/* && 연산자: error가 truthy일 때만 뒤의 JSX 렌더링 */}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Login failed: {error}
          </div>
        )}

        {/* Google 로그인 버튼이 여기에 렌더링됨 (useGoogleSignIn이 처리) */}
        <div ref={buttonRef} className="mt-6 w-full opacity-85 transition hover:opacity-100" />

        {/* 로그인 후 이동할 경로 표시 (디버그/안내용) */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Redirect after login</div>
          <div className="mt-1 break-all font-mono text-xs text-white/80">{redirect}</div>
        </div>
      </div>
    </div>
  );
}
