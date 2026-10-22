import type { Order, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const orderInclude = {
  customer: {
    select: { id: true, email: true, name: true, phone: true },
  },
  deliveryPartner: {
    select: { id: true, email: true, name: true, phone: true },
  },
  address: true,
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          unit: true,
          category: true,
          isActive: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
  },
  tracking: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export const orderRepository = {
  findByIdempotencyKey(key: string): Promise<OrderWithRelations | null> {
    return prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: orderInclude,
    });
  },

  findById(id: string): Promise<OrderWithRelations | null> {
    return prisma.order.findUnique({ where: { id }, include: orderInclude });
  },

  findCustomerOrder(
    id: string,
    customerId: string,
  ): Promise<OrderWithRelations | null> {
    return prisma.order.findFirst({
      where: { id, customerId },
      include: orderInclude,
    });
  },

  findRiderOrder(
    id: string,
    riderId: string,
  ): Promise<OrderWithRelations | null> {
    return prisma.order.findFirst({
      where: { id, deliveryPartnerId: riderId },
      include: orderInclude,
    });
  },

  async listCustomer(
    customerId: string,
    skip: number,
    take: number,
  ): Promise<[OrderWithRelations[], number]> {
    return prisma.$transaction([
      prisma.order.findMany({
        where: { customerId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      prisma.order.count({ where: { customerId } }),
    ]);
  },

  async listAdmin(
    where: Prisma.OrderWhereInput,
    skip: number,
    take: number,
  ): Promise<[OrderWithRelations[], number]> {
    return prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      prisma.order.count({ where }),
    ]);
  },

  create(data: Prisma.OrderUncheckedCreateInput): Promise<OrderWithRelations> {
    return prisma.order.create({ data, include: orderInclude });
  },

  update(
    id: string,
    data: Prisma.OrderUpdateInput,
  ): Promise<OrderWithRelations> {
    return prisma.order.update({
      where: { id },
      data,
      include: orderInclude,
    });
  },

  findPartnerUser(partnerId: string) {
    return prisma.user.findUnique({
      where: { id: partnerId },
      include: { deliveryProfile: true },
    });
  },

  countActiveAssignments(partnerId: string): Promise<number> {
    return prisma.order.count({
      where: {
        deliveryPartnerId: partnerId,
        status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
      },
    });
  },

  listRiderAssignments(
    riderId: string,
    statuses: Order['status'][],
    take = 50,
  ): Promise<OrderWithRelations[]> {
    return prisma.order.findMany({
      where: { deliveryPartnerId: riderId, status: { in: statuses } },
      orderBy: { createdAt: 'desc' },
      take,
      include: orderInclude,
    });
  },

  listRiderDeliveredSince(
    riderId: string,
    since: Date | null,
    take = 100,
  ): Promise<OrderWithRelations[]> {
    return prisma.order.findMany({
      where: {
        deliveryPartnerId: riderId,
        status: 'DELIVERED',
        ...(since ? { deliveredAt: { gte: since } } : {}),
      },
      orderBy: { deliveredAt: 'desc' },
      take,
      include: orderInclude,
    });
  },

  upsertTracking(
    orderId: string,
    data: {
      latitude: number;
      longitude: number;
      storeLatitude: number;
      storeLongitude: number;
      customerLatitude: number | null;
      customerLongitude: number | null;
    },
  ) {
    return prisma.orderTracking.upsert({
      where: { orderId },
      update: { latitude: data.latitude, longitude: data.longitude },
      create: {
        orderId,
        latitude: data.latitude,
        longitude: data.longitude,
        storeLatitude: data.storeLatitude,
        storeLongitude: data.storeLongitude,
        customerLatitude: data.customerLatitude,
        customerLongitude: data.customerLongitude,
      },
    });
  },

  findStore() {
    return prisma.store.findFirst();
  },
};
