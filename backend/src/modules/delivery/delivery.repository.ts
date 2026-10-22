import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

const profileInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DeliveryPartnerInclude;

export type DeliveryProfileWithUser = Prisma.DeliveryPartnerGetPayload<{
  include: typeof profileInclude;
}>;

export const deliveryRepository = {
  findProfile(userId: string): Promise<DeliveryProfileWithUser | null> {
    return prisma.deliveryPartner.findUnique({
      where: { userId },
      include: profileInclude,
    });
  },

  updateAvailability(
    userId: string,
    isAvailable: boolean,
  ): Promise<DeliveryProfileWithUser> {
    return prisma.deliveryPartner.update({
      where: { userId },
      data: { isAvailable },
      include: profileInclude,
    });
  },

  countDeliveredSince(
    userId: string,
    since: Date | null,
  ): Promise<number> {
    return prisma.order.count({
      where: {
        deliveryPartnerId: userId,
        status: 'DELIVERED',
        ...(since ? { deliveredAt: { gte: since } } : {}),
      },
    });
  },

  findStore() {
    return prisma.store.findFirst();
  },
};
