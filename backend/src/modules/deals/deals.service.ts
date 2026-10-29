import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { publish } from '../../utils/events';
import { getPaginationParams, getPaginationMeta } from '../../utils/response';

/**
 * Near-expiry flash deals: percentage markdowns with stock caps. Deal prices
 * flow through checkout via `dealPctFor`, so a deal created in the admin
 * panel changes what customers pay — no manual price edits.
 */

export function effectivePrice(price: Prisma.Decimal | number, dealPct: number): Prisma.Decimal {
  if (dealPct <= 0) return new Prisma.Decimal(price);
  const capped = Math.min(dealPct, env.FLASH_DEAL_MAX_PCT);
  return new Prisma.Decimal(price).mul(1 - capped / 100);
}

/** Active deal % for a product (0 when none), cached lookup helper. */
export async function dealPctMap(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const now = new Date();
  const deals = await prisma.flashDeal.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      productId: { in: productIds },
    },
  });
  const map = new Map<string, number>();
  for (const deal of deals) {
    // Respect stockLimit: a deal is live only while stock remains.
    if (deal.stockLimit !== null && deal.usedCount >= deal.stockLimit) continue;
    map.set(deal.productId, deal.discountPct);
  }
  return map;
}

export const dealsService = {
  async listPublic(page?: unknown, limit?: unknown) {
    const pagination = getPaginationParams(
      typeof page === 'string' ? page : undefined,
      typeof limit === 'string' ? limit : undefined,
      20,
      50,
    );
    const now = new Date();
    const [deals, total] = await Promise.all([
      prisma.flashDeal.findMany({
        where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: { startsAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          product: {
            select: { id: true, name: true, unit: true, price: true, imageUrl: true, category: true, stock: true, isActive: true },
          },
        },
      }),
      prisma.flashDeal.count({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
    ]);

    const live = deals.filter(
      (deal) => deal.product.isActive && deal.product.stock > 0 && (deal.stockLimit === null || deal.usedCount < deal.stockLimit),
    );
    return {
      data: live.map((deal) => ({
        id: deal.id,
        discountPct: deal.discountPct,
        endsAt: deal.endsAt,
        remaining: deal.stockLimit !== null ? Math.max(0, deal.stockLimit - deal.usedCount) : null,
        product: {
          ...deal.product,
          price: Number(deal.product.price),
          dealPrice: Number(effectivePrice(deal.product.price, deal.discountPct)),
        },
      })),
      pagination: getPaginationMeta(pagination.page, pagination.limit, total),
    };
  },

  /** Admin CRUD */
  async adminList() {
    const deals = await prisma.flashDeal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { product: { select: { name: true, price: true } } },
    });
    return deals.map((deal) => ({
      id: deal.id,
      discountPct: deal.discountPct,
      startsAt: deal.startsAt,
      endsAt: deal.endsAt,
      stockLimit: deal.stockLimit,
      usedCount: deal.usedCount,
      isActive: deal.isActive,
      product: deal.product,
    }));
  },

  async adminCreate(input: {
    productId: string;
    discountPct: number;
    startsAt: string;
    endsAt: string;
    stockLimit?: number;
  }) {
    if (input.discountPct < 1 || input.discountPct > env.FLASH_DEAL_MAX_PCT) {
      throw new AppError(
        `Discount must be 1–${env.FLASH_DEAL_MAX_PCT}%`,
        422,
        'DEAL_DISCOUNT_RANGE',
      );
    }
    const endsAt = new Date(input.endsAt);
    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(endsAt.getTime()) || Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) {
      throw new AppError('The deal window is invalid', 422, 'DEAL_WINDOW_INVALID');
    }
    const deal = await prisma.flashDeal.create({
      data: {
        productId: input.productId,
        discountPct: input.discountPct,
        startsAt,
        endsAt,
        stockLimit: input.stockLimit ?? null,
        isActive: true,
      },
    });
    publish('admin', 'deal.created', { dealId: deal.id, productId: deal.productId });
    return deal;
  },

  async adminUpdate(
    id: string,
    patch: { discountPct?: number; isActive?: boolean; endsAt?: string; stockLimit?: number | null },
  ) {
    const deal = await prisma.flashDeal.findUnique({ where: { id } });
    if (!deal) throw new AppError('Deal not found', 404, 'DEAL_NOT_FOUND');
    const data: Prisma.FlashDealUpdateInput = {};
    if (patch.discountPct !== undefined) {
      if (patch.discountPct < 1 || patch.discountPct > env.FLASH_DEAL_MAX_PCT) {
        throw new AppError(`Discount must be 1–${env.FLASH_DEAL_MAX_PCT}%`, 422, 'DEAL_DISCOUNT_RANGE');
      }
      data.discountPct = patch.discountPct;
    }
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.endsAt !== undefined) {
      const endsAt = new Date(patch.endsAt);
      if (Number.isNaN(endsAt.getTime())) throw new AppError('Invalid end date', 422, 'DEAL_WINDOW_INVALID');
      data.endsAt = endsAt;
    }
    if (patch.stockLimit !== undefined) data.stockLimit = patch.stockLimit;
    return prisma.flashDeal.update({ where: { id }, data });
  },

  async adminDelete(id: string) {
    const deal = await prisma.flashDeal.findUnique({ where: { id } });
    if (!deal) throw new AppError('Deal not found', 404, 'DEAL_NOT_FOUND');
    await prisma.flashDeal.delete({ where: { id } });
    return { id };
  },
};
