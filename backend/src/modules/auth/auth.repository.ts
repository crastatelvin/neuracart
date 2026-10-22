import type {
  DeliveryPartner,
  Prisma,
  RefreshToken,
  User,
} from '@prisma/client';
import { prisma } from '../../config/prisma';

export type UserWithDeliveryProfile = User & {
  deliveryProfile: DeliveryPartner | null;
};

export const authRepository = {
  findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findUserWithProfileById(id: string): Promise<UserWithDeliveryProfile | null> {
    return prisma.user.findUnique({
      where: { id },
      include: { deliveryProfile: true },
    });
  },

  findDeliveryUserByEmail(email: string): Promise<UserWithDeliveryProfile | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { deliveryProfile: true },
    });
  },

  createCustomer(email: string): Promise<User> {
    return prisma.user.create({
      data: {
        email,
        role: 'CUSTOMER',
      },
    });
  },

  updateProfile(
    id: string,
    data: Prisma.UserUpdateInput,
  ): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  updateLastLogin(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },

  invalidateActiveOtps(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.otpCode.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  },

  createOtp(input: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return prisma.otpCode.create({
      data: input,
      select: { id: true },
    });
  },

  findLatestActiveOtp(userId: string) {
    return prisma.otpCode.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async incrementOtpAttempts(id: string): Promise<number> {
    const updated = await prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts;
  },

  markOtpUsed(id: string): Promise<{ id: string }> {
    return prisma.otpCode.update({
      where: { id },
      data: { usedAt: new Date() },
      select: { id: true },
    });
  },

  createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data: input });
  },

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  async revokeRefreshTokenIfActive(id: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  },

  revokeFamily(family: string): Promise<Prisma.BatchPayload> {
    return prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
