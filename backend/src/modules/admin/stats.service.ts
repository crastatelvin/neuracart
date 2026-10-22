import { Prisma } from '@prisma/client';
import { API_ORDER_STATUS, API_PAYMENT_STATUS } from '../../utils/enums';
import {
  formatIstDate,
  startOfIstDay,
  startOfIstDaysAgo,
} from '../../utils/ist';
import { absoluteAssetUrl } from '../../utils/url';
import { statsRepository } from './admin.repository';
import type { StatsQuery, StatsRange } from './admin.schemas';

const RANGE_DAYS: Record<StatsRange, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

const LOW_STOCK_THRESHOLD = 5;

export const statsService = {
  async getStats(query: StatsQuery) {
    const days = RANGE_DAYS[query.range];
    const rangeStart = startOfIstDaysAgo(days - 1);
    const todayStart = startOfIstDay();

    const [
      todayOrders,
      pendingOrders,
      activeDeliveries,
      todayDelivered,
      statusGroups,
      deliveredInRange,
      lowStockCount,
      lowStock,
      totalCustomers,
      recentOrders,
    ] = await Promise.all([
      statsRepository.countOrdersSince(todayStart),
      statsRepository.countOrdersByStatus('PENDING'),
      statsRepository.countActiveDeliveries(),
      statsRepository.aggregateDeliveredSince(todayStart),
      statsRepository.groupByStatusSince(rangeStart),
      statsRepository.findDeliveredSince(rangeStart),
      statsRepository.countLowStock(LOW_STOCK_THRESHOLD),
      statsRepository.findLowStock(LOW_STOCK_THRESHOLD, 10),
      statsRepository.countCustomers(),
      statsRepository.findRecentOrders(5),
    ]);

    const revenue = todayDelivered._sum.total ?? new Prisma.Decimal(0);
    const deliveredCount = todayDelivered._count._all;
    const average = deliveredCount > 0
      ? revenue.div(deliveredCount)
      : new Prisma.Decimal(0);

    const ordersByStatus = Object.fromEntries(
      Object.values(API_ORDER_STATUS).map((status) => [status, 0]),
    ) as Record<string, number>;
    for (const group of statusGroups) {
      ordersByStatus[API_ORDER_STATUS[group.status]] = group._count._all;
    }

    const series = new Map<
      string,
      { revenue: Prisma.Decimal; orders: number }
    >();
    for (const order of deliveredInRange) {
      if (!order.deliveredAt) continue;
      const key = formatIstDate(order.deliveredAt);
      const current = series.get(key) ?? {
        revenue: new Prisma.Decimal(0),
        orders: 0,
      };
      current.revenue = current.revenue.plus(order.total);
      current.orders += 1;
      series.set(key, current);
    }

    const revenueSeries = Array.from({ length: days }, (_, index) => {
      const date = new Date(rangeStart.getTime() + index * 86_400_000);
      const key = formatIstDate(date);
      const value = series.get(key);
      return {
        date: key,
        revenue: (value?.revenue ?? new Prisma.Decimal(0)).toFixed(2),
        orders: value?.orders ?? 0,
      };
    });

    return {
      range: query.range,
      todayOrders,
      todayRevenue: revenue.toFixed(2),
      pendingOrders,
      activeDeliveries,
      averageOrderValue: average.toFixed(2),
      lowStockCount,
      totalCustomers,
      ordersByStatus,
      revenueSeries,
      lowStock: lowStock.map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        unit: product.unit,
        imageUrl: absoluteAssetUrl(product.imageUrl),
      })),
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: API_ORDER_STATUS[order.status],
        paymentStatus: API_PAYMENT_STATUS[order.paymentStatus],
        total: order.total.toFixed(2),
        itemCount: order._count.items,
        customer: order.customer,
        createdAt: order.createdAt,
      })),
    };
  },
};
