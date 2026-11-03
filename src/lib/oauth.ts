import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { API_BASE } from './config';
import { apiRequest } from './api';

export type OAuthTokens = { accessToken: string; refreshToken: string };

/** Pull the session tokens the API appends to the redirect URL. */
export function parseOAuthTokens(url: string | null | undefined): OAuthTokens | null {
  if (!url) return null;
  const query = url.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query.split('#')[0]);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function fetchGoogleStatus(): Promise<{ configured: boolean }> {
  return apiRequest<{ configured: boolean }>('/auth/google/status', { auth: false });
}

/**
 * Opens Google's consent screen. On native the app reopens through the
 * neuracart:// deep link and the tokens come back in the result URL. On web we
 * do a full redirect and the root layout consumes the tokens on return.
 */
export async function startGoogleSignIn(): Promise<OAuthTokens | null> {
  if (Platform.OS === 'web') {
    const redirect = `${window.location.origin}/`;
    window.location.assign(
      `${API_BASE}/auth/google?redirect=${encodeURIComponent(redirect)}`,
    );
    return null;
  }

  const redirectUri = Linking.createURL('');
  const startUrl = `${API_BASE}/auth/google?redirect=${encodeURIComponent(redirectUri)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  if (result.type !== 'success') return null;
  return parseOAuthTokens(result.url);
}
