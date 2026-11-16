import type { AuthResponse } from '@pathway/shared';

/** The access token lives only in memory; the refresh token is an httpOnly cookie. */
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
}

let refreshing: Promise<AuthResponse | null> | null = null;

/** Single-flight: concurrent callers share one request (refresh tokens are single-use). */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((res) => (res.ok ? (res.json() as Promise<AuthResponse>) : null))
    .catch(() => null)
    .then((session) => {
      accessToken = session?.accessToken ?? null;
      return session;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await send(path, init);
  // Expired access token: refresh once, then retry the original request.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send(path, init);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`, data);
  return data as T;
}

/**
 * POSTs JSON and reads a Server-Sent-Events reply (`data: {"token":"..."}` ... `data: [DONE]`).
 * fetch is used instead of EventSource because EventSource can't send an Authorization header.
 */
export async function streamPost(
  path: string,
  body: unknown,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const init = { method: 'POST', body: JSON.stringify(body), signal };
  let res = await send(path, init);
  if (res.status === 401 && (await refreshSession())) res = await send(path, init);
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`, data);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const isError = event.startsWith('event: error');
      const data = event
        .split('\n')
        .find((l) => l.startsWith('data: '))
        ?.slice(6);
      if (!data) continue;
      if (data === '[DONE]') return;
      const parsed = JSON.parse(data) as { token?: string; message?: string };
      if (isError) throw new Error(parsed.message ?? 'The AI service is unavailable');
      if (parsed.token) onToken(parsed.token);
    }
  }
}
