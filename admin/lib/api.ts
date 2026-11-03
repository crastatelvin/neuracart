import type { AdminUser, Pagination, Session } from './types';

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
).replace(/\/$/, '');

const ACCESS_KEY = 'neuracart.admin.accessToken';
const REFRESH_KEY = 'neuracart.admin.refreshToken';
const USER_KEY = 'neuracart.admin.user';

export class ApiError extends Error {
  status: number;
  code: string;
  errors?: unknown;

  constructor(message: string, status = 0, code = 'NETWORK_ERROR', errors?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

type Envelope<T> = {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
  code?: string;
  errors?: unknown;
};

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const accessToken = window.localStorage.getItem(ACCESS_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_KEY);
    const rawUser = window.localStorage.getItem(USER_KEY);
    if (!accessToken || !refreshToken || !rawUser) return null;
    const user = JSON.parse(rawUser) as AdminUser;
    if (user.role !== 'admin') return null;
    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AdminUser | null {
  return readSession()?.user ?? null;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const session = readSession();
    if (!session) return false;
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      const payload = (await response.json()) as Envelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      if (!response.ok || !payload.data) {
        clearSession();
        return false;
      }
      writeSession({
        ...session,
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.assign('/login?expired=1');
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  redirectOnUnauthorized?: boolean;
};

async function execute<T>(
  path: string,
  options: RequestOptions,
  hasRetried: boolean,
): Promise<Envelope<T>> {
  const auth = options.auth !== false;
  const session = readSession();
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (auth && session) headers.Authorization = `Bearer ${session.accessToken}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'We could not reach the NeuraCart API. Check that the backend is running.',
    );
  }

  if (response.status === 401 && auth && !hasRetried) {
    const refreshed = await refreshTokens();
    if (refreshed) return execute<T>(path, options, true);
    if (options.redirectOnUnauthorized !== false) redirectToLogin();
  }

  let payload: Envelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new ApiError('The server returned an unexpected response.', response.status);
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message || `Request failed (${response.status})`,
      response.status,
      payload?.code || 'REQUEST_FAILED',
      payload?.errors,
    );
  }

  if (!payload) {
    return { success: true, message: '', data: undefined as T };
  }
  return payload;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await execute<T>(path, options, false);
  return payload.data;
}

export async function apiPage<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T[]; pagination: Pagination }> {
  const payload = await execute<T[]>(path, options, false);
  return {
    data: payload.data ?? [],
    pagination:
      payload.pagination ?? {
        page: 1,
        limit: (payload.data ?? []).length,
        total: (payload.data ?? []).length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
  };
}

export function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function sendAdminOtp(
  email: string,
): Promise<{ devOtp?: string }> {
  return api<{ devOtp?: string }>('/auth/admin/send-otp', {
    method: 'POST',
    auth: false,
    body: { email },
    redirectOnUnauthorized: false,
  });
}

export async function verifyAdminOtp(
  email: string,
  code: string,
): Promise<Session> {
  const result = await api<{
    accessToken: string;
    refreshToken: string;
    user: AdminUser;
  }>('/auth/admin/verify-otp', {
    method: 'POST',
    auth: false,
    body: { email, code },
    redirectOnUnauthorized: false,
  });
  if (result.user.role !== 'admin') {
    throw new ApiError('Access denied. Admins only.', 403, 'ADMIN_ONLY');
  }
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  writeSession(session);
  return session;
}

export async function logoutAdmin(): Promise<void> {
  const session = readSession();
  if (session) {
    try {
      await api('/auth/logout', {
        method: 'POST',
        auth: false,
        body: { refreshToken: session.refreshToken },
        redirectOnUnauthorized: false,
      });
    } catch {
      // Local sign-out should succeed even when the network is unavailable.
    }
  }
  clearSession();
}

export function isAdminAuthenticated(): boolean {
  return !!readSession();
}
