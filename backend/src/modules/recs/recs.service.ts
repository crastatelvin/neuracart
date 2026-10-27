import { Prisma, type Product } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** Product card shape shared with the customer app. */
type RecCard = {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  imageUrl: string | null;
  stock: number;
  isFeatured: boolean;
  tags: string[];
};

export type ReorderEntry = RecCard & {
  lastOrderedAt: string;
  daysSinceLastPurchase: number;
  typicalIntervalDays: number | null;
  urgency: 'running_low' | 'likely_out' | 'due_soon';
  lastQuantity: number;
};

export type HomeFeed = {
  reorder: ReorderEntry[];
  buyAgain: RecCard[];
  together: RecCard[];
  featured: RecCard[];
  recipes: Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    servings: number;
    items: number;
  }>;
  headline: string | null;
};

type ProductWithDeal = Product & {
  flashDeals?: Array<{ discountPct: number }>;
};

const toCard = (product: ProductWithDeal): RecCard => {
  const flash = product.flashDeals?.[0]?.discountPct ?? null;
  const price = flash
    ? Number(product.price) * (1 - flash / 100)
    : Number(product.price);
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: price.toFixed(2),
    unit: product.unit,
    imageUrl: product.imageUrl,
    stock: product.stock,
    isFeatured: product.isFeatured,
    tags: product.tags,
  };
};

const REORDER_WINDOW_DAYS = 120;

export const recsService = {
  /** Consumption-rate reorder prediction from the customer's own history. */
  async reorder(userId: string): Promise<ReorderEntry[]> {
    const since = new Date(Date.now() - REORDER_WINDOW_DAYS * 86_400_000);
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          customerId: userId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: since },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
      include: {
        product: true,
        order: { select: { createdAt: true } },
      },
    });

    type Track = { dates: Date[]; lastQty: number; product: Product };
    const tracks = new Map<string, Track>();
    for (const item of items) {
      if (!item.product.isActive) continue;
      const track = tracks.get(item.productId) ?? {
        dates: [],
        lastQty: item.quantity,
        product: item.product,
      };
      track.dates.push(item.order.createdAt);
      track.lastQty = item.quantity;
      tracks.set(item.productId, track);
    }

    const DAY = 86_400_000;
    const entries: ReorderEntry[] = [];
    for (const [, track] of tracks) {
      // Purchases on the same day count as one purchase event.
      const purchaseDays = [
        ...new Set(track.dates.map((d) => d.toISOString().slice(0, 10))),
      ]
        .map((iso) => new Date(iso))
        .sort((a, b) => a.getTime() - b.getTime());
      if (purchaseDays.length === 0) continue;

      const gapsDays: number[] = [];
      for (let i = 1; i < purchaseDays.length; i += 1) {
        gapsDays.push((purchaseDays[i].getTime() - purchaseDays[i - 1].getTime()) / DAY);
      }
      // Median interval, clamped to a sane [3, 30] day band so one odd gap
      // does not dominate the prediction.
      const median = gapsDays.length
        ? gapsDays.sort((a, b) => a - b)[Math.floor(gapsDays.length / 2)]
        : 7;
      const typical = Math.min(30, Math.max(3, Math.round(median)));

      const lastAt = track.dates[track.dates.length - 1];
      const daysSince = Math.floor((Date.now() - lastAt.getTime()) / DAY);
      if (daysSince < typical * 0.75) continue; // not due yet

      const urgency =
        typical * 1.8 < daysSince
          ? 'likely_out'
          : typical * 1.15 < daysSince
            ? 'running_low'
            : 'due_soon';

      entries.push({
        ...toCard(track.product),
        lastOrderedAt: lastAt.toISOString(),
        daysSinceLastPurchase: daysSince,
        typicalIntervalDays: gapsDays.length ? typical : null,
        urgency,
        lastQuantity: track.lastQty,
      });
    }

    return entries
      .sort((a, b) => {
        const rank = { likely_out: 0, running_low: 1, due_soon: 2 } as const;
        return (
          rank[a.urgency] - rank[b.urgency] ||
          b.daysSinceLastPurchase - a.daysSinceLastPurchase
        );
      })
      .slice(0, 8);
  },

  /** Recent products the customer already bought (straight "Buy again"). */
  async buyAgain(userId: string, limit = 10): Promise<RecCard[]> {
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          customerId: userId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: new Date(Date.now() - 45 * 86_400_000) },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
      include: {
        product: {
          include: {
            flashDeals: {
              where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
            },
          },
        },
      },
      distinct: ['productId'],
      take: limit,
    });
    return items.map((item) => toCard(item.product as ProductWithDeal));
  },

  /**
   * Co-purchase CF: products that most often appear in other (non-cancelled)
   * orders that also contain the seed items. Works globally, so the signal
   * reflects every customer, not just the requester.
   */
  async together(cartIds: string[], userId: string): Promise<RecCard[]> {
    const exclude = new Set(cartIds);
    let seedTexts = cartIds;
    if (seedTexts.length === 0) {
      const recent = await prisma.orderItem.findMany({
        where: {
          order: {
            customerId: userId,
            status: { not: 'CANCELLED' },
            createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
          },
        },
        distinct: ['productId'],
        orderBy: { order: { createdAt: 'desc' } },
        take: 3,
        select: { productId: true },
      });
      const recentIds = recent.map((entry) => entry.productId);
      for (const id of recentIds) exclude.add(id);
      seedTexts = recentIds;
    }
    if (seedTexts.length === 0) return [];

    const rows = await prisma.$queryRaw<Array<{ productId: string; score: bigint }>>(
      Prisma.sql`
        SELECT b."productId"::text AS "productId", COUNT(*)::bigint AS score
        FROM order_items a
        JOIN orders o ON o.id = a."orderId" AND o.status <> 'CANCELLED'
        JOIN order_items b ON b."orderId" = a."orderId"
        WHERE a."productId"::text IN (${Prisma.join(seedTexts)})
          AND b."productId"::text NOT IN (${Prisma.join(seedTexts)})
        GROUP BY b."productId"
        ORDER BY score DESC
        LIMIT 12
      `,
    );
    if (rows.length === 0) return [];

    const scored = new Map<string, number>(
      rows.map((row) => [row.productId, Number(row.score)]),
    );
    const candidates = await prisma.product.findMany({
      where: {
        id: { in: [...scored.keys()] },
        isActive: true,
        stock: { gt: 0 },
      },
      include: {
        flashDeals: {
          where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
        },
      },
    });
    return candidates
      .filter((product) => !exclude.has(product.id))
      .sort((a, b) => (scored.get(b.id) ?? 0) - (scored.get(a.id) ?? 0))
      .slice(0, 8)
      .map((product) => toCard(product as ProductWithDeal));
  },

  async featured(limit = 8): Promise<RecCard[]> {
    const products = await prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        flashDeals: {
          where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
        },
      },
    });
    return products.map((product) => toCard(product as ProductWithDeal));
  },

  async recipes(limit = 4) {
    const recipes = await prisma.recipe.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { _count: { select: { items: true } } },
    });
    return recipes.map((recipe) => ({
      id: recipe.id,
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      servings: recipe.servings,
      items: recipe._count.items,
    }));
  },

  async home(userId: string, cartIds: string[]): Promise<HomeFeed> {
    const [reorder, buyAgainCards, featuredCards, recipeCards, togetherCards] =
      await Promise.all([
        this.reorder(userId),
        this.buyAgain(userId),
        this.featured(),
        this.recipes(),
        this.together(cartIds, userId),
      ]);

    const headline =
      reorder[0] != null
        ? reorder[0].urgency === 'likely_out'
          ? `You may be out of ${reorder[0].name}`
          : reorder[0].urgency === 'running_low'
            ? `Running low? Time for ${reorder[0].name}?`
            : null
        : null;

    return {
      reorder,
      buyAgain: buyAgainCards,
      together: togetherCards,
      featured: featuredCards,
      recipes: recipeCards,
      headline,
    };
  },
};
