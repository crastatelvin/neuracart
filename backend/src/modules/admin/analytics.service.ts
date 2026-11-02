import { OrderStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { formatIstDate, startOfIstDay, startOfIstDaysAgo } from '../../utils/ist';

/**
 * Deterministic planning helpers: a 7-day moving-average forecast and stock
 * cover alerts. No LLM involved, so these work with or without an API key.
 */

const HISTORY_DAYS = 14;

function daysAgoKey(daysAgo: number): string {
  return formatIstDate(startOfIstDaysAgo(daysAgo));
}

export const analyticsService = {
  async forecast(days = 7) {
    const since = startOfIstDaysAgo(HISTORY_DAYS);
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { createdAt: true, total: true },
    });

    const buckets = new Map<string, { orders: number; revenue: number }>();
    for (let offset = HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
      buckets.set(daysAgoKey(offset), { orders: 0, revenue: 0 });
    }
    for (const order of orders) {
      const bucket = buckets.get(formatIstDate(order.createdAt));
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.revenue += Number(order.total);
    }

    const history = [...buckets.entries()].map(([date, value]) => ({
      date,
      orders: value.orders,
      revenue: Math.round(value.revenue * 100) / 100,
    }));

    const recent = history.slice(-7);
    const avgOrders = recent.reduce((sum, day) => sum + day.orders, 0) / 7;
    const avgRevenue = recent.reduce((sum, day) => sum + day.revenue, 0) / 7;

    const forecast = Array.from({ length: days }, (_, index) => {
      const date = new Date(startOfIstDay().getTime() + (index + 1) * 24 * 3600_000);
      return {
        date: formatIstDate(date),
        orders: Math.round(avgOrders),
        revenue: Math.round(avgRevenue * 100) / 100,
      };
    });

    return {
      history,
      forecast,
      averages: {
        ordersPerDay: Math.round(avgOrders * 10) / 10,
        revenuePerDay: Math.round(avgRevenue * 100) / 100,
      },
      nextPeriod: {
        days,
        orders: forecast.reduce((sum, day) => sum + day.orders, 0),
        revenue: Math.round(forecast.reduce((sum, day) => sum + day.revenue, 0) * 100) / 100,
      },
      basis: 'average of the last 7 days (cancelled orders excluded)',
    };
  },

  async stockAlerts() {
    const since = startOfIstDaysAgo(7);
    const [products, sales] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, unit: true, category: true, stock: true },
        orderBy: { stock: 'asc' },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            createdAt: { gte: since },
            status: { not: OrderStatus.CANCELLED },
          },
        },
        _sum: { quantity: true },
      }),
    ]);

    const soldById = new Map(
      sales.map((row) => [row.productId, row._sum.quantity ?? 0]),
    );

    return products
      .map((product) => {
        const soldLast7Days = soldById.get(product.id) ?? 0;
        const dailyRate = soldLast7Days / 7;
        const coverDays =
          dailyRate > 0 ? Math.round((product.stock / dailyRate) * 10) / 10 : null;
        return { ...product, soldLast7Days, dailyRate, coverDays };
      })
      .filter((product) =>
        product.coverDays !== null ? product.coverDays < 3 : product.stock <= 5,
      )
      .sort((a, b) => {
        const left = a.coverDays ?? Number.POSITIVE_INFINITY;
        const right = b.coverDays ?? Number.POSITIVE_INFINITY;
        if (left !== right) return left - right;
        return a.stock - b.stock;
      })
      .slice(0, 25)
      .map((product) => ({
        ...product,
        reason:
          product.coverDays !== null
            ? `About ${product.coverDays} day${product.coverDays === 1 ? '' : 's'} of stock left at the current rate`
            : 'Low stock and no recent sales',
      }));
  },
};
