import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { sendOrderStatusEmail, sendRiderDeclinedEmail } from '../../services/email.service';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import {
  startOfIstDay,
  startOfIstPeriod,
  type EarningsPeriod,
} from '../../utils/ist';
import { orderInclude, orderRepository } from '../orders/order.repository';
import {
  ASSIGNMENT_ACCEPTED_NOTE,
  isAssignmentAccepted,
  serializeOrder,
} from '../orders/order.serializer';
import { orderService } from '../orders/order.service';
import type { OrderWithRelations } from '../orders/order.repository';
import { deliveryRepository, type DeliveryProfileWithUser } from './delivery.repository';
import type {
  AssignmentQuery,
  AvailabilityInput,
  CompleteAssignmentInput,
  EarningsQuery,
} from './delivery.schemas';

type AssignmentGroupName = 'new' | 'ready' | 'active' | 'completed';

function profileOrThrow(profile: DeliveryProfileWithUser | null): DeliveryProfileWithUser {
  if (!profile) {
    throw new AppError('Delivery profile not found', 404, 'RIDER_PROFILE_NOT_FOUND');
  }
  return profile;
}

function serializeProfile(profile: DeliveryProfileWithUser) {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone,
    vehicleType: profile.vehicleType,
    vehicleNumber: profile.vehicleNumber,
    isAvailable: profile.isAvailable,
    isVerified: profile.isVerified,
    totalDeliveries: profile.totalDeliveries,
    earnings: profile.earnings.toFixed(2),
    rating: null,
    memberSince: profile.user.createdAt,
  };
}

function notifyCustomer(order: OrderWithRelations, status: 'OUT_FOR_DELIVERY' | 'DELIVERED'): void {
  void sendOrderStatusEmail({
    to: order.customer.email,
    orderNumber: order.orderNumber,
    status,
    total: order.total.toFixed(2),
  }).catch((error: unknown) => {
    logger.error('Could not send delivery status email', {
      orderId: order.id,
      status,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });
}

function assignmentGroup(order: OrderWithRelations): AssignmentGroupName {
  if (order.status === 'OUT_FOR_DELIVERY') return 'active';
  if (order.status === 'DELIVERED') return 'completed';
  return isAssignmentAccepted(order) ? 'ready' : 'new';
}

function emptyGroups() {
  return {
    new: [] as ReturnType<typeof serializeOrder>[],
    ready: [] as ReturnType<typeof serializeOrder>[],
    active: [] as ReturnType<typeof serializeOrder>[],
    completed: [] as ReturnType<typeof serializeOrder>[],
  };
}

export const deliveryService = {
  async getProfile(userId: string) {
    const profile = profileOrThrow(
      await deliveryRepository.findProfile(userId),
    );
    return serializeProfile(profile);
  },

  async getAssignments(userId: string, query: AssignmentQuery) {
    const [activeOrders, completedOrders] = await Promise.all([
      orderRepository.listRiderAssignments(
        userId,
        ['ASSIGNED', 'OUT_FOR_DELIVERY'],
        100,
      ),
      orderRepository.listRiderDeliveredSince(userId, startOfIstDay(), 20),
    ]);

    const allGroups = emptyGroups();
    for (const order of activeOrders) {
      allGroups[assignmentGroup(order)].push(serializeOrder(order));
    }
    for (const order of completedOrders) {
      allGroups.completed.push(serializeOrder(order));
    }

    const counts = {
      new: allGroups.new.length,
      ready: allGroups.ready.length,
      active: allGroups.active.length,
      completed: allGroups.completed.length,
      current:
        allGroups.new.length + allGroups.ready.length + allGroups.active.length,
    };

    if (query.status === 'all') {
      return { ...allGroups, counts };
    }

    const filtered = emptyGroups();
    if (query.status === 'active') {
      filtered.new = allGroups.new;
      filtered.ready = allGroups.ready;
      filtered.active = allGroups.active;
    } else {
      filtered[query.status] = allGroups[query.status];
    }
    return { ...filtered, counts };
  },

  async accept(orderId: string, userId: string) {
    const order = await orderRepository.findRiderOrder(orderId, userId);
    if (!order) {
      throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    }
    if (order.status !== 'ASSIGNED') {
      throw new AppError(
        'This assignment is no longer waiting for acceptance',
        409,
        'ASSIGNMENT_NOT_ACTIVE',
      );
    }
    if (isAssignmentAccepted(order)) {
      return serializeOrder(order);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          deliveryPartnerId: userId,
          status: 'ASSIGNED',
        },
        data: { updatedAt: new Date() },
      });
      if (result.count !== 1) {
        throw new AppError(
          'This assignment changed before it could be accepted',
          409,
          'ASSIGNMENT_NOT_ACTIVE',
        );
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: 'ASSIGNED',
          note: ASSIGNMENT_ACCEPTED_NOTE,
          changedBy: userId,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });

    logger.info('Delivery assignment accepted', { orderId, riderId: userId });
    return serializeOrder(updated);
  },

  async reject(orderId: string, userId: string) {
    const order = await orderRepository.findRiderOrder(orderId, userId);
    if (!order) {
      throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    }
    if (order.status !== 'ASSIGNED') {
      throw new AppError(
        'You can only decline before pickup',
        409,
        'CANNOT_DECLINE',
      );
    }

    const [updated, profile, store] = await Promise.all([
      prisma.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            deliveryPartnerId: userId,
            status: 'ASSIGNED',
          },
          data: { status: 'PREPARING', deliveryPartnerId: null },
        });
        if (result.count !== 1) {
          throw new AppError(
            'This assignment changed before it could be declined',
            409,
            'CANNOT_DECLINE',
          );
        }
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'PREPARING',
            note: 'Rider declined',
            changedBy: userId,
          },
        });
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderInclude,
        });
      }),
      deliveryRepository.findProfile(userId),
      deliveryRepository.findStore(),
    ]);

    if (store && profile) {
      void sendRiderDeclinedEmail({
        to: store.email,
        orderNumber: updated.orderNumber,
        riderName: profile.user.name ?? profile.user.email,
      }).catch((error: unknown) => {
        logger.error('Could not send rider-declined email', {
          orderId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }
    logger.info('Delivery assignment declined', { orderId, riderId: userId });
    return serializeOrder(updated);
  },

  async start(orderId: string, userId: string) {
    const order = await orderRepository.findRiderOrder(orderId, userId);
    if (!order) {
      throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    }
    if (order.status !== 'ASSIGNED') {
      throw new AppError(
        'This assignment is not ready to start',
        409,
        'ASSIGNMENT_NOT_ACTIVE',
      );
    }
    if (!isAssignmentAccepted(order)) {
      throw new AppError(
        'Accept the assignment before starting the delivery',
        400,
        'ASSIGNMENT_NOT_ACCEPTED',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          deliveryPartnerId: userId,
          status: 'ASSIGNED',
        },
        data: {
          status: 'OUT_FOR_DELIVERY',
          estimatedAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      if (result.count !== 1) {
        throw new AppError(
          'This assignment changed before it could be started',
          409,
          'ASSIGNMENT_NOT_ACTIVE',
        );
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: 'OUT_FOR_DELIVERY',
          note: 'Rider started the delivery',
          changedBy: userId,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });

    notifyCustomer(updated, 'OUT_FOR_DELIVERY');
    logger.info('Delivery started', { orderId, riderId: userId });
    return serializeOrder(updated);
  },

  async complete(
    orderId: string,
    userId: string,
    input: CompleteAssignmentInput,
  ) {
    const note = input.proof
      ? `Delivered with ${input.proof.type} proof`
      : 'Delivered by rider';
    return orderService.completeByRider(orderId, userId, note);
  },

  async earnings(userId: string, query: EarningsQuery) {
    const profile = profileOrThrow(
      await deliveryRepository.findProfile(userId),
    );
    const since = startOfIstPeriod(query.period as EarningsPeriod);
    const [deliveries, history, allTimeDeliveries] = await Promise.all([
      deliveryRepository.countDeliveredSince(userId, since),
      orderRepository.listRiderDeliveredSince(userId, since, 50),
      deliveryRepository.countDeliveredSince(userId, null),
    ]);

    const total = new Prisma.Decimal(env.RIDER_PAYOUT).mul(deliveries);
    const average = deliveries === 0 ? new Prisma.Decimal(0) : total.div(deliveries);
    const allTimeTotal = new Prisma.Decimal(env.RIDER_PAYOUT).mul(
      allTimeDeliveries,
    );

    if (
      profile.totalDeliveries !== allTimeDeliveries ||
      !profile.earnings.equals(allTimeTotal)
    ) {
      logger.warn('Rider earnings ledger mismatch', {
        riderId: userId,
        profileDeliveries: profile.totalDeliveries,
        computedDeliveries: allTimeDeliveries,
        profileEarnings: profile.earnings.toFixed(2),
        computedEarnings: allTimeTotal.toFixed(2),
      });
    }

    return {
      period: query.period,
      total: total.toFixed(2),
      deliveries,
      average: average.toFixed(2),
      payoutPerDelivery: env.RIDER_PAYOUT,
      history: history.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        deliveredAt: order.deliveredAt,
        payout: env.RIDER_PAYOUT.toFixed(2),
        customerName: order.customer.name ?? 'Customer',
        customerArea: [order.address.line2, order.address.city]
          .filter(Boolean)
          .join(', '),
      })),
      lifetime: {
        deliveries: profile.totalDeliveries,
        earnings: profile.earnings.toFixed(2),
      },
    };
  },

  async updateAvailability(userId: string, input: AvailabilityInput) {
    profileOrThrow(await deliveryRepository.findProfile(userId));
    const profile = await deliveryRepository.updateAvailability(
      userId,
      input.isAvailable,
    );
    logger.info('Rider availability changed', {
      riderId: userId,
      isAvailable: input.isAvailable,
    });
    return serializeProfile(profile);
  },
};
