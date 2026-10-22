import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type { ListPartnersQuery } from './deliveryPartner.schemas';

const partnerInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DeliveryPartnerInclude;

export type AdminPartner = Prisma.DeliveryPartnerGetPayload<{
  include: typeof partnerInclude;
}>;

export const deliveryPartnerAdminRepository = {
  async list(query: ListPartnersQuery) {
    const search = query.search?.trim();
    const where: Prisma.DeliveryPartnerWhereInput = {
      ...(query.available !== undefined
        ? { isAvailable: query.available }
        : {}),
      ...(query.verified !== undefined ? { isVerified: query.verified } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    return prisma.$transaction([
      prisma.deliveryPartner.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: partnerInclude,
      }),
      prisma.deliveryPartner.count({ where }),
    ]);
  },

  findById(userId: string): Promise<AdminPartner | null> {
    return prisma.deliveryPartner.findUnique({
      where: { userId },
      include: partnerInclude,
    });
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async create(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    vehicleType: string;
    vehicleNumber: string;
  }): Promise<AdminPartner> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          password: input.password,
          role: 'DELIVERY_PARTNER',
        },
      });
      return tx.deliveryPartner.create({
        data: {
          userId: user.id,
          vehicleType: input.vehicleType,
          vehicleNumber: input.vehicleNumber,
        },
        include: partnerInclude,
      });
    });
  },

  async update(
    userId: string,
    userData: Prisma.UserUpdateInput,
    profileData: Prisma.DeliveryPartnerUpdateInput,
  ): Promise<AdminPartner> {
    return prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }
      return tx.deliveryPartner.update({
        where: { userId },
        data: profileData,
        include: partnerInclude,
      });
    });
  },

  async setActive(userId: string, isActive: boolean): Promise<AdminPartner> {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isActive } });
      return tx.deliveryPartner.update({
        where: { userId },
        data: { isAvailable: false },
        include: partnerInclude,
      });
    });
  },

  async activeAssignmentCounts(userIds: string[]) {
    if (userIds.length === 0) return [];
    return prisma.order.groupBy({
      by: ['deliveryPartnerId'],
      where: {
        deliveryPartnerId: { in: userIds },
        status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
      },
      _count: { _all: true },
    });
  },

  countActiveAssignments(userId: string): Promise<number> {
    return prisma.order.count({
      where: {
        deliveryPartnerId: userId,
        status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
      },
    });
  },
};
