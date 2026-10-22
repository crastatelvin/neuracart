import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from './errors';

export type AccessPayload = {
  userId: string;
  email: string;
  role: Role;
};

export type RefreshPayload = {
  userId: string;
  family: string;
  tokenId: string;
};

type AccessTokenPayload = JwtPayload & AccessPayload & { type: 'access' };
type RefreshTokenPayload = JwtPayload & RefreshPayload & { type: 'refresh' };

const ISSUER = 'localmart-api';
const AUDIENCE = 'localmart-clients';

function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported duration "${value}". Use e.g. 15m, 7d.`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: payload.userId,
    },
  );
}

export function signRefreshToken(
  userId: string,
  family: string,
): { token: string; tokenId: string; family: string; expiresAt: Date } {
  const tokenId = randomUUID();
  const payload: RefreshPayload = { userId, family, tokenId };
  const token = jwt.sign(
    { ...payload, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: userId,
    },
  );
  const expiresAt = new Date(
    Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN),
  );
  return { token, tokenId, family, expiresAt };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === 'string') {
      throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
    }
    if (
      decoded.type !== 'access' ||
      typeof decoded.userId !== 'string' ||
      typeof decoded.email !== 'string' ||
      !Object.values(Role).includes(decoded.role as Role)
    ) {
      throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
    }
    return decoded as AccessTokenPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Access token expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === 'string') {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    if (
      decoded.type !== 'refresh' ||
      typeof decoded.userId !== 'string' ||
      typeof decoded.family !== 'string' ||
      typeof decoded.tokenId !== 'string'
    ) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    return decoded as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
}
