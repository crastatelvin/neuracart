import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

export function generateOtp(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashOtp(code: string, userId: string): string {
  return createHash('sha256')
    .update(`${userId}:${code}:${env.OTP_PEPPER}`)
    .digest('hex');
}

export function verifyOtpHash(code: string, userId: string, hash: string): boolean {
  const candidate = Buffer.from(hashOtp(code, userId), 'hex');
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function getOtpExpiry(now = new Date()): Date {
  return new Date(now.getTime() + env.OTP_EXPIRES_IN_MINUTES * 60_000);
}

export function isExpired(date: Date, now = new Date()): boolean {
  return date.getTime() <= now.getTime();
}
