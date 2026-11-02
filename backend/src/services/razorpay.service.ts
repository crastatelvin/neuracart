import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

/**
 * Razorpay test-mode client. No SDK: one REST call and one HMAC check.
 * Everything is env-gated — without keys the store stays on UPI intent + COD.
 */

const API_ROOT = 'https://api.razorpay.com/v1';

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  return `Basic ${Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString('base64')}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
};

export async function createRazorpayOrder(input: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new AppError('Razorpay is not configured', 503, 'PAYMENTS_UNAVAILABLE');
  }
  const response = await fetch(`${API_ROOT}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: Math.round(input.amountInr * 100),
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new AppError(
      `Razorpay rejected the order: ${text.slice(0, 200)}`,
      502,
      'PAYMENT_PROVIDER_ERROR',
    );
  }
  return (await response.json()) as RazorpayOrder;
}

export function verifyRazorpaySignature(
  body: string,
  signature: string | undefined,
): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
