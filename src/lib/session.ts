import { API_BASE } from './config';
import { secureStorage, storageKeys } from './storage';

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired(): void {
  sessionExpiredHandler?.();
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function hydrateSessionTokens(): Promise<void> {
  [accessToken, refreshToken] = await Promise.all([
    secureStorage.get(storageKeys.accessToken),
    secureStorage.get(storageKeys.refreshToken),
  ]);
}

export async function setSessionTokens(
  tokens: SessionTokens,
  persist = true,
): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  if (persist) {
    await Promise.all([
      secureStorage.set(storageKeys.accessToken, tokens.accessToken),
      secureStorage.set(storageKeys.refreshToken, tokens.refreshToken),
    ]);
  }
}

export async function clearSessionTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([
    secureStorage.remove(storageKeys.accessToken),
    secureStorage.remove(storageKeys.refreshToken),
  ]);
}

export async function refreshSessionTokens(): Promise<boolean> {
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await clearSessionTokens();
        notifySessionExpired();
        return false;
      }
      const body = (await response.json()) as {
        data?: { accessToken?: string; refreshToken?: string };
      };
      if (!body.data?.accessToken || !body.data.refreshToken) {
        await clearSessionTokens();
        notifySessionExpired();
        return false;
      }
      await setSessionTokens({
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
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
