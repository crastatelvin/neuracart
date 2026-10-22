import type { OrderStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const statsRepository = {
  countOrdersSince(since: Date): Promise<number> {
    return prisma.order.count({ where: { createdAt: { gte: since } } });
  },

  countOrdersByStatus(status: OrderStatus): Promise<number> {
    return prisma.order.count({ where: { status } });
  },

  countActiveDeliveries(): Promise<number> {
    return prisma.order.count({
      where: { status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] } },
    });
  },

  aggregateDeliveredSince(since: Date) {
    return prisma.order.aggregate({
      where: { status: 'DELIVERED', deliveredAt: { gte: since } },
      _sum: { total: true },
      _count: { _all: true },
    });
  },

  groupByStatusSince(since: Date) {
    return prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
  },

  findDeliveredSince(since: Date) {
    return prisma.order.findMany({
      where: { status: 'DELIVERED', deliveredAt: { gte: since } },
      select: { deliveredAt: true, total: true },
    });
  },

  countLowStock(threshold: number): Promise<number> {
    return prisma.product.count({
      where: { isActive: true, stock: { lte: threshold } },
    });
  },

  findLowStock(threshold: number, take: number) {
    return prisma.product.findMany({
      where: { isActive: true, stock: { lte: threshold } },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take,
      select: { id: true, name: true, stock: true, unit: true, imageUrl: true },
    });
  },

  countCustomers(): Promise<number> {
    return prisma.user.count({
      where: { role: 'CUSTOMER', isActive: true },
    });
  },

  findRecentOrders(take: number) {
    return prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
    });
  },
};
