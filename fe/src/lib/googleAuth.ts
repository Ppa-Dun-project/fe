// React 훅 가져오기
// - useCallback: 함수를 메모이제이션 (불필요한 재생성 방지)
// - useEffect: 컴포넌트 생명주기 처리 (마운트/언마운트 등)
// - useRef: DOM 요소에 대한 참조를 저장 (렌더링과 무관한 값)
import { useCallback, useEffect, useRef } from "react";
import { apiPost } from "./api";
import { login } from "./auth";

// Google OAuth 클라이언트 ID — 환경변수로 주입 (환경별로 다른 ID 가능)
// .env.development / .env.production 에 VITE_GOOGLE_CLIENT_ID 설정 필요
const RAW_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

if (!RAW_GOOGLE_CLIENT_ID) {
  // 빌드/런타임 단계에서 즉시 실패시켜야 잘못된 환경 설정을 빨리 발견
  throw new Error(
    "VITE_GOOGLE_CLIENT_ID is not set. Add it to your .env file."
  );
}

// 위에서 throw 했으므로 여기서부터는 반드시 string (TS narrowing이 안 되어 별도 const)
export const GOOGLE_CLIENT_ID: string = RAW_GOOGLE_CLIENT_ID;

// Google이 로그인 성공 시 반환하는 객체 타입
export type GoogleCredentialResponse = {
  credential: string;  // 서명된 JWT 토큰 (유저 정보가 담겨있음)
};

// 백엔드가 반환하는 응답 타입 (우리 DB의 유저 정보)
type AuthResponse = {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
};

// Google Identity Services 버튼 설정 — 리터럴 유니온으로 오타 방지
type ButtonConfig = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "small" | "medium" | "large";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;  // Google IS는 픽셀 숫자만 받음 ("100%" 같은 문자열은 무시됨)
  locale?: string;
};

// Google의 전역 객체 타입 (window.google.accounts.id)
// - Google Identity Services 스크립트가 index.html에서 로드됨
type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (r: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (el: HTMLElement, config: ButtonConfig) => void;
  cancel: () => void;
};

// window.google 을 전역 타입으로 선언 → 매번 `as unknown as` 단언 불필요
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

// Google 로그인 버튼의 기본 스타일 설정
// - width 는 부모 div 의 CSS 로 제어 (Google IS는 "100%" 문자열을 무시함)
const BUTTON_CONFIG: ButtonConfig = {
  theme: "outline",       // 아웃라인 스타일
  size: "large",          // 크기
  text: "signin_with",    // 버튼 텍스트: "Sign in with Google"
  shape: "pill",          // 둥근 알약 모양
  locale: "en",           // 영어 표시
};

// Google IS 스크립트 로딩 폴링 간격(ms) / 최대 대기 시간(ms)
const SCRIPT_POLL_INTERVAL_MS = 100;
const SCRIPT_POLL_TIMEOUT_MS = 10_000;

/**
 * useGoogleSignIn: Google 로그인 기능을 간편하게 붙여주는 커스텀 훅
 *
 * 사용 방법:
 *   const buttonRef = useGoogleSignIn(
 *     () => navigate("/"),
 *     (msg) => setError(msg),  // (선택) 에러 메시지 표시
 *   );
 *   return <div ref={buttonRef} />;  // ← 여기에 Google 버튼이 렌더링됨
 *
 * 동작 흐름:
 * 1. ref를 DOM div에 연결
 * 2. Google IS 스크립트가 로드될 때까지 폴링 (최대 10초)
 * 3. Google 라이브러리가 그 div 안에 로그인 버튼을 그림
 * 4. 유저가 버튼 클릭 → Google이 ID 토큰 발급
 * 5. 토큰을 백엔드에 전송 → 검증 + DB 저장
 * 6. 응답 검증 후 localStorage에 토큰 저장
 * 7. onSuccess 콜백 실행 (보통 페이지 이동)
 * 8. 실패 시 onError 콜백 호출 (UI 알림 가능)
 */
export function useGoogleSignIn(
  onSuccess: () => void,
  onError?: (message: string) => void,
) {
  // useRef<HTMLDivElement>: 타입이 HTMLDivElement인 ref 생성
  // - 초기값 null, 나중에 실제 DOM div가 연결됨
  const buttonRef = useRef<HTMLDivElement>(null);

  // useCallback: onSuccess / onError 가 바뀔 때만 함수를 새로 만듦
  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      // 백엔드로 Google 토큰 전송 → 검증 + DB 저장 → 응답 받기
      apiPost<AuthResponse, { credential: string }>("/api/auth/google/verify", {
        credential: response.credential,
      })
        .then((data) => {
          // 응답 형태 검증 — undefined가 localStorage에 저장되는 사고 방지
          // (이전에 백엔드 에러 응답이 들어왔을 때 "undefined" 토큰이 저장되던 버그)
          if (!data?.access_token || typeof data.access_token !== "string") {
            throw new Error("Invalid auth response: missing access_token");
          }
          login(data.access_token);
          onSuccess();
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Google login failed";
          console.error("Google login failed:", err);
          onError?.(message);
        });
    },
    [onSuccess, onError],
  );

  // useEffect: 컴포넌트 마운트 시 실행 + handleCredential 변경 시 재실행
  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    const startedAt = Date.now();
    // 클로저로 ref 의 현재 값을 캡처 → cleanup 시점에 ref.current 가 바뀌어도 안전
    const containerOnMount = buttonRef.current;

    // Google Identity Services 스크립트가 로드될 때까지 폴링
    // - 마운트 시점에 스크립트가 아직 안 왔어도 결국 버튼이 그려지도록 보장
    const tryInit = () => {
      if (cancelled) return;

      const google = window.google?.accounts?.id;
      const container = buttonRef.current;

      if (!google || !container) {
        // 10초가 지나도 안 오면 포기 (네트워크 차단 / 광고 차단기 등)
        if (Date.now() - startedAt > SCRIPT_POLL_TIMEOUT_MS) {
          const message =
            "Google Sign-In script failed to load. Check your network or ad blocker.";
          console.error(message);
          onError?.(message);
          return;
        }
        pollTimer = window.setTimeout(tryInit, SCRIPT_POLL_INTERVAL_MS);
        return;
      }

      google.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });

      // 컨테이너를 비우고 다시 그림 → effect 재실행 시 버튼이 중복 쌓이는 것 방지
      container.innerHTML = "";
      google.renderButton(container, BUTTON_CONFIG);
    };

    tryInit();

    // cleanup: 언마운트 또는 effect 재실행 직전에 호출
    // - 폴링 중단, 진행 중인 OAuth 흐름 취소, 버튼 DOM 정리
    return () => {
      cancelled = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      window.google?.accounts?.id?.cancel();
      if (containerOnMount) containerOnMount.innerHTML = "";
    };
  }, [handleCredential, onError]);

  // ref를 반환해서 컴포넌트가 자기 div에 붙일 수 있게 함
  return buttonRef;
}
