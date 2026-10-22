import { Prisma } from '@prisma/client';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDateKey(now: Date): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function istDayBounds(now: Date): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const start = new Date(startShifted - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/**
 * Generates LM-YYYYMMDD-0001 using today's IST order count.
 * Must be called inside the order-placement transaction; retry on P2002.
 */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  now = new Date(),
): Promise<string> {
  const { start, end } = istDayBounds(now);
  const count = await tx.order.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return `LM-${istDateKey(now)}-${String(count + 1).padStart(4, '0')}`;
}
