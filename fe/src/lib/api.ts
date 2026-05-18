import { getAccessToken } from "./auth";

// ── API base URL setup ──
// import.meta.env: Vite's environment-variable object (injected at build time)
// VITE_API_BASE_URL: backend address set in the .env file (e.g. "http://localhost:8000")
// ?.trim(): if a value exists, strip surrounding whitespace; otherwise return undefined (optional chaining)
// ?? "": if the value is undefined/null, use an empty string (nullish coalescing)
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

// .replace(/\/+$/, ""): regex strips every trailing slash from the URL
// - e.g. "http://api.com///" → "http://api.com"
// - Reason: prevents duplicate slashes when we later append paths
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

// QueryValue: the value types allowed for URL query parameters
// - "|" is a union type (one of several types)
type QueryValue = string | number | boolean | null | undefined;

/**
 * Helper that assembles a path and query params into a complete URL string.
 * Example: buildUrl("/api/players", { query: "Judge", limit: 10 })
 *    → "/api/players?query=Judge&limit=10"
 */
function buildUrl(path: string, params?: Record<string, QueryValue>) {
  // Auto-prepend a slash if the path is missing one (defensive)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Use the base URL if one is configured; otherwise fall back to a relative path (Vite proxy handles it)
  const base = API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;

  // Return immediately if there are no query params
  if (!params) return base;

  // URLSearchParams: built-in browser query-string builder
  // - Automatically URL-encodes special characters (space → %20, etc.)
  const query = new URLSearchParams();

  // Object.entries: converts an object to an array of [key, value] pairs
  // e.g. { query: "Judge" } → [["query", "Judge"]]
  for (const [key, value] of Object.entries(params)) {
    // Skip null/undefined/empty-string values (no point including them)
    if (value === null || value === undefined || value === "") continue;
    // String(): safely coerce any value (numbers, booleans, etc.) to a string
    query.set(key, String(value));
  }

  // .toString(): yields a string like "query=Judge&limit=10"
  const queryString = query.toString();
  // Append the "?" and query string when present; otherwise return base alone
  return queryString ? `${base}?${queryString}` : base;
}

/**
 * Core fetch wrapper.
 * - Sends the request, checks for errors, and parses JSON.
 * - <T> generic: the caller specifies the response data's type.
 *
 * Terminology:
 * - fetch: built-in browser HTTP request function (sends a request, returns a response)
 * - async/await: syntax that lets you write asynchronous code in a synchronous-looking style
 * - Promise<T>: an async result that will eventually resolve to a value of type T
 */
async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  // await: wait for the server response to arrive
  const res = await fetch(input, init);

  // res.ok: true if HTTP status is in the 200–299 range, false otherwise
  if (!res.ok) {
    // Read the error response body as text
    const message = await res.text();
    // throw: raise an error that the caller can handle via .catch()
    throw new Error(message || `HTTP ${res.status}`);
  }

  // Parse the response body as JSON and return it typed as T
  // as T: TypeScript type assertion (tells the compiler "trust me, this is T")
  return (await res.json()) as T;
}

/**
 * GET request — used when reading data.
 * - path: API path (e.g. "/api/players")
 * - params: query parameters (optional)
 * - signal: AbortSignal for cancelling the request (optional) — used in useEffect cleanup
 */
export function apiGet<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), { signal });
}

/**
 * POST request — used when sending data to the server (login, create, etc.).
 * - TResponse: response type / TBody: request body type
 */
export function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<TResponse>(buildUrl(path, params), {
    method: "POST",                                      // HTTP method
    headers: { "Content-Type": "application/json" },     // Tell the server we're sending JSON
    body: JSON.stringify(body),                          // Convert the object to a JSON string
    signal,
  });
}

/**
 * DELETE request — used when removing data (e.g. dropping a draft pick).
 */
export function apiDelete<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), { method: "DELETE", signal });
}

// ── Helpers for authenticated requests ──
// The apiGetAuth / apiPostAuth / apiDeleteAuth helpers below
// automatically attach an `Authorization: Bearer <JWT>` header.
// If there is no token (unauthenticated), they throw an Error, so callers must use .catch.

/**
 * authHeaders: assembles and returns the Authorization header.
 * - Throws explicitly if there is no token (failing fast is better than firing a request without the header and getting a 401).
 */
function authHeaders(): HeadersInit {
  const token = getAccessToken();
  if (!token) throw new Error("Missing access token");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Authenticated GET request.
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
 * Authenticated POST request.
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
 * Authenticated PUT request — partial or full update of an existing resource.
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
 * Authenticated DELETE request.
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
