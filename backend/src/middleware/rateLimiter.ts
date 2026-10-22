import {
  ipKeyGenerator,
  rateLimit,
  type RateLimitExceededEventHandler,
} from 'express-rate-limit';
import { sendError } from '../utils/response';

function limitHandler(message: string): RateLimitExceededEventHandler {
  return (_req, res) => {
    sendError(res, message, 429, undefined, 'RATE_LIMITED');
  };
}

const shared = {
  standardHeaders: true as const,
  legacyHeaders: false,
  handler: limitHandler('Too many requests. Please try again later.'),
};

export const globalRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 300,
});

export const otpRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 5,
  handler: limitHandler('Too many OTP requests. Try again in 15 minutes.'),
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}:${email}`;
  },
});

export const authRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 20,
  handler: limitHandler('Too many login attempts. Try again later.'),
});

export const uploadRateLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? 'unknown'),
});

export const placeOrderRateLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60_000,
  limit: 10,
  handler: limitHandler('Too many orders. Please try again later.'),
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? 'unknown'),
});
