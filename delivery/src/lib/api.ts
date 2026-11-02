import { API_BASE } from './config';
import {
  getAccessToken,
  getRefreshToken,
  notifySessionExpired,
  refreshSessionTokens,
} from './session';
import type { ApiEnvelope, Pagination } from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  code: string;
  errors?: unknown;

  constructor(message: string, status: number, code = 'REQUEST_ERROR', errors?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function buildQuery(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return '';
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `?${params.join('&')}` : '';
}

export function apiPath(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  return `${path}${buildQuery(query)}`;
}

async function performRequest<T>(
  path: string,
  options: ApiRequestOptions,
  isRetry = false,
): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortListener = () => controller.abort();
  options.signal?.addEventListener('abort', abortListener, { once: true });

  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.auth !== false && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: ApiEnvelope<T> | null = null;
    try {
      body = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : null;
    } catch {
      body = null;
    }

    if (__DEV__) {
      console.log(`[api] ${options.method ?? 'GET'} ${path} -> ${response.status}`);
    }

    if (!response.ok) {
      const status = response.status;
      const code = body?.code ?? 'REQUEST_ERROR';
      const canRefresh =
        status === 401 &&
        options.auth !== false &&
        !isRetry &&
        !!getRefreshToken() &&
        path !== '/auth/refresh';

      if (canRefresh) {
        const refreshed = await refreshSessionTokens();
        if (refreshed) {
          clearTimeout(timeout);
          options.signal?.removeEventListener('abort', abortListener);
          return performRequest<T>(path, options, true);
        }
        notifySessionExpired();
      }

      throw new ApiError(
        body?.message ?? 'Something went wrong. Please try again.',
        status,
        code,
        body?.errors,
      );
    }

    if (!body) {
      return { success: true, message: 'Success', data: undefined as T };
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        options.signal?.aborted
          ? 'Request cancelled.'
          : 'The request timed out. Please try again.',
        0,
        'NETWORK_TIMEOUT',
      );
    }
    throw new ApiError(
      'You’re offline. Check your connection and try again.',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortListener);
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const envelope = await performRequest<T>(path, options);
  return envelope.data;
}

export async function apiRequestPage<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ data: T[]; pagination: Pagination }> {
  const envelope = await performRequest<T[]>(path, options);
  const pagination = envelope.pagination ?? {
    page: 1,
    limit: envelope.data.length,
    total: envelope.data.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };
  return { data: envelope.data, pagination };
}

/** Multipart upload (proof-of-delivery photos). Same envelope handling, no JSON body. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const raw = await response.text();
  let body: ApiEnvelope<T> | null = null;
  try {
    body = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new ApiError(
      body?.message ?? 'Upload failed. Please try again.',
      response.status,
      body?.code ?? 'UPLOAD_ERROR',
      body?.errors,
    );
  }
  return body?.data as T;
}

export function apiErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'NETWORK_ERROR') {
      return 'You’re offline. Check your connection and try again.';
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
