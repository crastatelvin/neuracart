import type { Store } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from './errors';

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function parseClock(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function istMinutes(now = new Date()): number {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function isStoreOpenNow(store: Store, now = new Date()): boolean {
  if (!store.isOpen) return false;
  const open = parseClock(store.openTime);
  const close = parseClock(store.closeTime);
  if (open === close) return true;
  const current = istMinutes(now);
  if (open < close) return current >= open && current < close;
  return current >= open || current < close;
}

export function assertServiceablePincode(pincode: string): void {
  if (!env.SERVICE_PINCODES.includes(pincode)) {
    throw new AppError(
      'We do not deliver to this pincode yet',
      400,
      'OUTSIDE_SERVICE_AREA',
    );
  }
}
