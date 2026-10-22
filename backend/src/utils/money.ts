import { Prisma } from '@prisma/client';
import { env } from '../config/env';

export type MoneyInput = number | string | Prisma.Decimal;

export function toDecimal(value: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function toMoneyString(value: MoneyInput): string {
  return toDecimal(value).toFixed(2);
}

export function formatINR(value: MoneyInput): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toDecimal(value).toNumber());
}

export function calculateDeliveryFee(subtotal: MoneyInput): Prisma.Decimal {
  const amount = toDecimal(subtotal);
  if (amount.greaterThanOrEqualTo(env.FREE_DELIVERY_ABOVE)) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(env.DELIVERY_FEE);
}

export function addMoney(...values: MoneyInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(toDecimal(value)),
    new Prisma.Decimal(0),
  );
}
