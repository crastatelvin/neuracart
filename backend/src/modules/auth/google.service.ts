import { randomBytes } from 'node:crypto';
import { Role } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { safeUser, issueTokens, type SafeUser } from './auth.service';
import { authRepository as repo } from './auth.repository';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

type PendingState = { redirect: string | null; expiresAt: number };

// ponytail: in-process state map, fine for a single API instance. Move to
// Redis (or a signed state JWT) if the API ever scales horizontally.
const pendingStates = new Map<string, PendingState>();
const STATE_TTL_MS = 10 * 60_000;

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
};

export function googleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function createGoogleAuthUrl(redirect: string | null): string {
  if (!googleConfigured()) {
    throw new AppError(
      'Google sign-in is not configured on this server',
      503,
      'GOOGLE_NOT_CONFIGURED',
    );
  }

  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (value.expiresAt < now) pendingStates.delete(key);
  }

  const state = randomBytes(24).toString('hex');
  pendingStates.set(state, {
    redirect: sanitizeRedirect(redirect),
    expiresAt: now + STATE_TTL_MS,
  });

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

function sanitizeRedirect(redirect: string | null): string | null {
  if (!redirect) return null;
  if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
    const origin = new URL(redirect).origin;
    if (!env.CORS_ORIGINS.includes(origin)) return null;
    return redirect;
  }
  // Native deep links such as neuracart://auth or exp://.../--/auth.
  return redirect;
}

async function exchangeCode(code: string): Promise<GoogleProfile> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URL,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.warn('Google token exchange failed', {
      status: response.status,
      detail: detail.slice(0, 200),
    });
    throw new AppError('Google sign-in failed. Try again.', 401, 'GOOGLE_TOKEN_ERROR');
  }

  const tokens = (await response.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new AppError('Google sign-in failed. Try again.', 401, 'GOOGLE_TOKEN_ERROR');
  }

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new AppError('Could not read your Google profile', 401, 'GOOGLE_PROFILE_ERROR');
  }
  return (await profileResponse.json()) as GoogleProfile;
}

export async function loginWithGoogle(
  code: string,
  state: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
  redirect: string | null;
}> {
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending || pending.expiresAt < Date.now()) {
    throw new AppError('Sign-in session expired. Try again.', 400, 'GOOGLE_STATE_INVALID');
  }

  const profile = await exchangeCode(code);
  const email = profile.email?.trim().toLowerCase();
  if (!email || !profile.email_verified) {
    throw new AppError(
      'Your Google account needs a verified email address',
      400,
      'GOOGLE_EMAIL_UNVERIFIED',
    );
  }

  let user = await repo.findUserByEmail(email);
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name ?? profile.given_name ?? null,
        role: Role.CUSTOMER,
      },
    });
    logger.info('Customer created via Google', { userId: user.id });
  } else if (user.role !== Role.CUSTOMER) {
    throw new AppError(
      'Use the admin or rider sign-in for this account',
      403,
      'WRONG_ROLE',
    );
  }
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated', 403, 'ACCOUNT_INACTIVE');
  }

  await repo.updateLastLogin(user.id);
  const tokens = await issueTokens(user);
  logger.info('Google login successful', { userId: user.id });
  return { ...tokens, user: safeUser(user), redirect: pending.redirect };
}

export function buildRedirectUrl(
  base: string,
  tokens: { accessToken: string; refreshToken: string },
): string {
  const url = new URL(base);
  url.searchParams.set('accessToken', tokens.accessToken);
  url.searchParams.set('refreshToken', tokens.refreshToken);
  return url.toString();
}
