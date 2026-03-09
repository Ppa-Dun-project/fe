const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

type QueryValue = string | number | boolean | null | undefined;

function buildUrl(path: string, params?: Record<string, QueryValue>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
  if (!params) return base;

  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    query.set(key, String(rawValue));
  }

  const queryString = query.toString();
  return queryString ? `${base}?${queryString}` : base;
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), { signal });
}

export function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<TResponse>(buildUrl(path, params), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export function apiDelete<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal
) {
  return requestJson<T>(buildUrl(path, params), {
    method: "DELETE",
    signal,
  });
}
