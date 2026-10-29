import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { publish } from '../../utils/events';
import { nextOrderNumber } from '../../utils/orderNumber';
import { assertServiceablePincode } from '../../utils/store';

/**
 * Delivery slots with capacity + weekly subscriptions that materialise into
 * PENDING orders. The subscription runner is admin-invoked (and cron-ready):
 * every due subscription produces a real order through the same stock rules as
 * a manual checkout.
 */

const WINDOWS = env.SLOT_WINDOWS.split(',').map((entry) => entry.trim()).filter(Boolean);

function windowLabel(window: string): string {
  const [start, end] = window.split('-');
  const label = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const display = hour > 12 ? hour - 12 : hour;
    return `${display}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${suffix}`;
  };
  return `${label(start ?? '08:00')}–${label(end ?? '10:00')}`;
}

async function ensureSlotsForDate(tx: Prisma.TransactionClient, date: Date): Promise<void> {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  await Promise.all(
    WINDOWS.map((window) => {
      const [startTime, endTime] = window.split('-');
      return tx.deliverySlot.upsert({
        where: {
          date_windowLabel: { date: day, windowLabel: windowLabel(window) },
        },
        update: {},
        create: {
          date: day,
          windowLabel: windowLabel(window),
          startTime: startTime ?? window,
          endTime: endTime ?? window,
          capacity: env.SLOT_CAPACITY_PER_WINDOW,
          isActive: true,
        },
      });
    }),
  );
}

export const schedulingService = {
  /** Next N days of slots (auto-extends via seed windows when queried). */
  async listSlots(days = 3) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + Math.min(Math.max(days, 1), 7));

    // Self-healing: backfill any date that has no slots yet.
    const existing = await prisma.deliverySlot.groupBy({
      by: ['date'],
      where: { date: { gte: today, lt: horizon } },
    });
    const have = new Set(existing.map((item) => item.date.toISOString().slice(0, 10)));
    for (let offset = 0; offset < Math.min(Math.max(days, 1), 7); offset += 1) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() + offset);
      if (have.has(day.toISOString().slice(0, 10))) continue;
      await prisma.$transaction(async (tx) => {
        await ensureSlotsForDate(tx, day);
      });
    }

    const slots = await prisma.deliverySlot.findMany({
      where: { date: { gte: today, lt: horizon }, isActive: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    const byDate = new Map<string, Array<{ id: string; windowLabel: string; available: number; capacity: number }>>();
    for (const slot of slots) {
      const key = slot.date.toISOString().slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push({
        id: slot.id,
        windowLabel: slot.windowLabel,
        available: Math.max(0, slot.capacity - slot.booked),
        capacity: slot.capacity,
      });
      byDate.set(key, list);
    }
    return [...byDate.entries()].map(([date, windows]) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return {
        date,
        label: parsed.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
        windows,
      };
    });
  },

  /** Create slots for the next N days (admin bulk tool). */
  async bulkSlots(days: number) {
    const created = await prisma.$transaction(async (tx) => {
      for (let offset = 0; offset < days; offset += 1) {
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        day.setUTCDate(day.getUTCDate() + offset);
        await ensureSlotsForDate(tx, day);
      }
      return tx.deliverySlot.count({ where: { date: { gte: new Date() } } });
    });
    return { futureSlots: created, days };
  },

  async consumeSlot(tx: Prisma.TransactionClient, slotId: string): Promise<Prisma.DeliverySlotGetPayload<Record<string, never>>> {
    const slot = await tx.deliverySlot.findUnique({ where: { id: slotId } });
    if (!slot || !slot.isActive) {
      throw new AppError('That delivery slot is unavailable', 404, 'SLOT_NOT_FOUND');
    }
    const future = slot.date.getTime() + 24 * 3600_000 >= Date.now();
    if (!future) {
      throw new AppError('That delivery slot has passed', 400, 'SLOT_PASSED');
    }
    const step = await tx.deliverySlot.updateMany({
      where: { id: slotId, booked: { lt: slot.capacity } },
      data: { booked: { increment: 1 } },
    });
    if (step.count !== 1) {
      throw new AppError('That delivery slot just filled up', 409, 'SLOT_FULL');
    }
    return slot;
  },

  // ————————————————————————————————— subscriptions ————————————————————————

  async listSubscriptions(userId: string) {
    const subs = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        address: { select: { label: true, line1: true, city: true } },
      },
    });
    const productIds = [
      ...new Set(subs.flatMap((sub) => (sub.items as Array<{ productId: string }>).map((item) => item.productId))),
    ];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unit: true, price: true, isActive: true, stock: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return subs.map((sub) => ({
      id: sub.id,
      status: sub.status,
      cadenceDays: sub.cadenceDays,
      dayOfWeek: sub.dayOfWeek,
      notes: sub.notes,
      nextRunAt: sub.nextRunAt,
      lastRunAt: sub.lastRunAt,
      address: sub.address,
      items: (sub.items as Array<{ productId: string; quantity: number }>).map((item) => ({
        ...item,
        product: byId.get(item.productId) ?? null,
      })),
    }));
  },

  async createSubscription(
    userId: string,
    input: {
      addressId: string;
      cadenceDays: number;
      dayOfWeek: number;
      notes?: string;
      items: Array<{ productId: string; quantity: number }>;
    },
  ) {
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId },
    });
    if (!address) {
      throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
    }
    assertServiceablePincode(address.pincode);
    if (!input.cadenceDays || input.cadenceDays % 7 !== 0 || input.cadenceDays > 28) {
      throw new AppError('Choose a weekly, biweekly, triweekly, or 4-weekly cadence', 422, 'CADENCE_INVALID');
    }
    const productIds = input.items.map((item) => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== new Set(productIds).size) {
      throw new AppError('One of the products is unavailable', 422, 'PRODUCT_UNAVAILABLE');
    }
    const totalUnits = input.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalUnits > env.SUBSCRIPTION_MAX_ITEMS) {
      throw new AppError(`Subscriptions are capped at ${env.SUBSCRIPTION_MAX_ITEMS} units`, 422, 'SUBSCRIPTION_ITEMS_LIMIT');
    }

    // First run anchored to the coming week at 05:00 IST ≈ 11:30 UTC.
    const nextRunAt = new Date();
    nextRunAt.setUTCDate(nextRunAt.getUTCDate() + 1);
    nextRunAt.setUTCHours(4, 30, 0, 0);

    const sub = await prisma.subscription.create({
      data: {
        userId,
        addressId: address.id,
        cadenceDays: input.cadenceDays,
        dayOfWeek: input.dayOfWeek,
        notes: input.notes?.slice(0, 300) ?? null,
        items: input.items,
        status: SubscriptionStatus.ACTIVE,
        nextRunAt,
      },
    });
    return { id: sub.id, status: sub.status, nextRunAt: sub.nextRunAt };
  },

  async updateSubscription(
    userId: string,
    id: string,
    patch: { status?: 'PAUSED' | 'ACTIVE' | 'CANCELLED'; items?: Array<{ productId: string; quantity: number }>; notes?: string | null },
  ) {
    const sub = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!sub) throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');

    const data: Prisma.SubscriptionUpdateInput = {};
    if (patch.status === 'CANCELLED') {
      data.status = SubscriptionStatus.CANCELLED;
    } else if (patch.status) {
      if (sub.status === SubscriptionStatus.CANCELLED) {
        throw new AppError('Cancelled subscriptions cannot resume', 409, 'SUBSCRIPTION_CANCELLED');
      }
      data.status = patch.status === 'ACTIVE' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAUSED;
      if (patch.status === 'ACTIVE' && sub.nextRunAt.getTime() <= Date.now()) {
        const next = new Date();
        next.setUTCDate(next.getUTCDate() + sub.cadenceDays);
        next.setUTCHours(4, 30, 0, 0);
        data.nextRunAt = next;
      }
    }
    if (patch.items) {
      data.items = patch.items;
    }
    if (patch.notes !== undefined) {
      data.notes = patch.notes?.slice(0, 300) ?? null;
    }
    const updated = await prisma.subscription.update({ where: { id }, data });
    return { id: updated.id, status: updated.status, nextRunAt: updated.nextRunAt };
  },

  /**
   * Materialise every due subscription into a PENDING order. Called by the
   * admin ("run due subscriptions now") and future cron; idempotent per run
   * because lastRunAt gates re-entry.
   */
  async runDueSubscriptions(): Promise<{ created: number; skipped: string[] }> {
    const due = await prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, nextRunAt: { lte: new Date() } },
      include: { address: true },
    });
    if (due.length === 0) return { created: 0, skipped: [] };

    const createdOrders: string[] = [];
    const skipped: string[] = [];

    for (const sub of due) {
      try {
        await prisma.$transaction(async (tx) => {
          // Transactional claim: only one runner can take a given lastRunAt.
          const claim = await tx.subscription.updateMany({
            where: {
              id: sub.id,
              status: SubscriptionStatus.ACTIVE,
              nextRunAt: { lte: new Date() },
              lastRunAt: sub.lastRunAt ?? null,
            },
            data: { lastRunAt: new Date() },
          });
          if (claim.count !== 1) {
            throw new AppError('Already run', 409, 'ALREADY_RUN');
          }

          const items = (sub.items as Array<{ productId: string; quantity: number }>).filter(
            (item) => item.quantity > 0,
          );
          const products = await tx.product.findMany({
            where: { id: { in: items.map((item) => item.productId) }, isActive: true },
          });
          const byId = new Map(products.map((product) => [product.id, product]));

          let subtotal = new Prisma.Decimal(0);
          for (const item of items) {
            const product = byId.get(item.productId);
            if (!product || product.stock < item.quantity) {
              skipped.push(sub.id);
              throw new AppError('Stock unavailable', 409, 'INSUFFICIENT_STOCK');
            }
            subtotal = subtotal.plus(product.price.mul(item.quantity));
          }
          for (const item of items) {
            await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
          }

          assertServiceablePincode(sub.address.pincode);
          const store = await tx.store.findFirst();
          const deliveryFee =
            store && subtotal.greaterThanOrEqualTo(store.freeDeliveryAbove)
              ? new Prisma.Decimal(0)
              : (store?.deliveryFee ?? new Prisma.Decimal(0));
          const orderNumber = await nextOrderNumber(tx);
          const estimatedAt = new Date(Date.now() + 45 * 60_000);

          await tx.order.create({
            data: {
              orderNumber,
              customerId: sub.userId,
              addressId: sub.addressId,
              status: 'PENDING',
              paymentStatus: 'PENDING',
              paymentMethod: 'COD',
              subtotal,
              deliveryFee,
              discount: new Prisma.Decimal(0),
              total: subtotal.plus(deliveryFee),
              notes: sub.notes ? `Weekly recurring order: ${sub.notes}` : null,
              estimatedAt,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: byId.get(item.productId)!.price,
                  total: byId.get(item.productId)!.price.mul(item.quantity),
                })),
              },
              statusHistory: {
                create: { status: 'PENDING', note: 'Placed by your weekly subscription', changedBy: sub.userId },
              },
              tracking: {
                create: {
                  storeLatitude: store?.latitude,
                  storeLongitude: store?.longitude,
                  customerLatitude: sub.address.latitude,
                  customerLongitude: sub.address.longitude,
                },
              },
            },
          });

          const nextRunAt = new Date(sub.nextRunAt);
          nextRunAt.setUTCDate(nextRunAt.getUTCDate() + sub.cadenceDays);
          await tx.subscription.update({
            where: { id: sub.id },
            data: { lastRunAt: new Date(), nextRunAt },
          });

          createdOrders.push(orderNumber);
        });
        publish(`user:${sub.userId}`, 'subscription.run', { subscriptionId: sub.id });
      } catch (error) {
        if (error instanceof AppError && error.code === 'ALREADY_RUN') continue;
        if (error instanceof AppError && error.code === 'INSUFFICIENT_STOCK') continue;
        logger.warn('Subscription run failed', { subscriptionId: sub.id, error: String(error) });
        skipped.push(sub.id);
      }
    }

    logger.info('Subscription runner finished', { created: createdOrders.length, skipped: skipped.length });
    return { created: createdOrders.length, skipped };
  },
};
