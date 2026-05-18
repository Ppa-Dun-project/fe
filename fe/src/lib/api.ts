import { getAccessToken } from "./auth";

// ── API 기본 URL 설정 ──
// import.meta.env: Vite가 제공하는 환경변수 객체 (빌드 타임에 주입됨)
// VITE_API_BASE_URL: .env 파일에서 설정한 백엔드 주소 (예: "http://localhost:8000")
// ?.trim(): 값이 있으면 앞뒤 공백 제거, 없으면 undefined 반환 (옵셔널 체이닝)
// ?? "": 값이 undefined/null이면 빈 문자열 사용 (nullish coalescing)
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

// .replace(/\/+$/, ""): 정규식으로 URL 끝의 슬래시 모두 제거
// - 예: "http://api.com///" → "http://api.com"
// - 이유: 나중에 /경로 를 붙일 때 슬래시 중복 방지
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

// QueryValue: URL 쿼리 파라미터 값으로 허용되는 타입들
// - "|"는 유니온 타입 (여러 타입 중 하나)
type QueryValue = string | number | boolean | null | undefined;

/**
 * URL과 쿼리 파라미터를 조립해서 완전한 URL 문자열을 만드는 함수
 * 예: buildUrl("/api/players", { query: "Judge", limit: 10 })
 *    → "/api/players?query=Judge&limit=10"
 */
function buildUrl(path: string, params?: Record<string, QueryValue>) {
  // 경로 앞에 슬래시가 없으면 자동으로 붙임 (실수 방지)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // 기본 URL이 있으면 합치고, 없으면 상대 경로만 사용 (Vite 프록시가 처리)
  const base = API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;

  // 쿼리 파라미터가 없으면 바로 반환
  if (!params) return base;

  // URLSearchParams: 브라우저 내장 쿼리 문자열 빌더
  // - 특수 문자를 자동으로 URL 인코딩해줌 (공백 → %20 등)
  const query = new URLSearchParams();

  // Object.entries: 객체를 [키, 값] 배열로 변환
  // 예: { query: "Judge" } → [["query", "Judge"]]
  for (const [key, value] of Object.entries(params)) {
    // null/undefined/빈 문자열은 쿼리에 포함하지 않음 (불필요한 파라미터 방지)
    if (value === null || value === undefined || value === "") continue;
    // String(): 모든 값을 문자열로 변환 (숫자, 불린 등도 안전하게)
    query.set(key, String(value));
  }

  // .toString(): "query=Judge&limit=10" 형태로 변환
  const queryString = query.toString();
  // 쿼리가 있으면 ? 붙여서 반환, 없으면 base만
  return queryString ? `${base}?${queryString}` : base;
}

/**
 * fetch의 핵심 래퍼 함수
 * - 요청을 보내고, 에러를 체크하고, JSON으로 파싱
 * - <T> 제네릭: 응답 데이터 타입을 호출하는 쪽이 지정
 *
 * 용어 설명:
 * - fetch: 브라우저 내장 HTTP 요청 함수 (서버에 요청을 보내고 응답을 받음)
 * - async/await: 비동기 작업을 동기처럼 쓸 수 있게 해주는 문법
 * - Promise<T>: 나중에 T 타입의 값이 반환될 것을 약속하는 비동기 결과
 */
async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  // await: 서버 응답이 도착할 때까지 대기
  const res = await fetch(input, init);

  // res.ok: HTTP 상태코드가 200~299면 true, 아니면 false
  if (!res.ok) {
    // 에러 응답의 본문을 텍스트로 읽어옴
    const message = await res.text();
    // throw: 에러를 발생시켜서 호출한 쪽의 .catch()로 전달
    throw new Error(message || `HTTP ${res.status}`);
  }

  // 응답 본문을 JSON으로 파싱 후, T 타입으로 반환
  // as T: TypeScript 타입 단언 (컴파일러에게 "이 타입이 맞다"고 알림)
  return (await res.json()) as T;
}

/**
 * GET 요청 — 데이터를 읽어올 때 사용
 * - path: API 경로 (예: "/api/players")
 * - params: 쿼리 파라미터 (선택)
 * - signal: 요청 취소용 AbortSignal (선택) — useEffect 클린업에서 사용
 */
export function apiGet<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), { signal });
}

/**
 * POST 요청 — 데이터를 서버로 보낼 때 사용 (로그인, 생성 등)
 * - TResponse: 응답 타입 / TBody: 요청 바디 타입
 */
export function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<TResponse>(buildUrl(path, params), {
    method: "POST",                                      // HTTP 메서드 지정
    headers: { "Content-Type": "application/json" },     // 서버에 "JSON 보낼게"라고 알림
    body: JSON.stringify(body),                          // 객체 → JSON 문자열 변환
    signal,
  });
}

/**
 * DELETE 요청 — 데이터를 삭제할 때 사용 (드래프트 픽 제거 등)
 */
export function apiDelete<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), { method: "DELETE", signal });
}

// ── 인증이 필요한 요청용 헬퍼 ──
// 아래 apiGetAuth / apiPostAuth / apiDeleteAuth 는
// Authorization: Bearer <JWT> 헤더를 자동으로 붙여서 요청을 보냄.
// 토큰이 없으면(비로그인) Error를 throw 하므로 호출부는 .catch 로 처리해야 함.

/**
 * authHeaders: Authorization 헤더를 조립해 반환
 * - 토큰이 없으면 명시적으로 에러 throw (헤더 없이 요청되어 401 받는 것보다 빠른 실패가 나음)
 */
function authHeaders(): HeadersInit {
  const token = getAccessToken();
  if (!token) throw new Error("Missing access token");
  return { Authorization: `Bearer ${token}` };
}

/**
 * 인증이 필요한 GET 요청
 */
export function apiGetAuth<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), {
    signal,
    headers: authHeaders(),
  });
}

/**
 * 인증이 필요한 POST 요청
 */
export function apiPostAuth<TResponse, TBody>(
  path: string,
  body: TBody,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<TResponse>(buildUrl(path, params), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * 인증이 필요한 PUT 요청 — 기존 리소스 부분/전체 갱신
 */
export function apiPutAuth<TResponse, TBody>(
  path: string,
  body: TBody,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<TResponse>(buildUrl(path, params), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * 인증이 필요한 DELETE 요청
 */
export function apiDeleteAuth<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), {
    method: "DELETE",
    headers: authHeaders(),
    signal,
  });
}
