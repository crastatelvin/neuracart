import { Prisma } from '@prisma/client';
import { sendDeliveryPartnerWelcomeEmail } from '../../services/email.service';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { hashPassword } from '../../utils/password';
import { getPaginationMeta, getPaginationParams } from '../../utils/response';
import {
  deliveryPartnerAdminRepository as repo,
  type AdminPartner,
} from './deliveryPartner.repository';
import type {
  CreatePartnerInput,
  ListPartnersQuery,
  UpdatePartnerInput,
  VerifyPartnerInput,
} from './deliveryPartner.schemas';

function serializePartner(partner: AdminPartner, activeAssignments = 0) {
  return {
    id: partner.user.id,
    profileId: partner.id,
    userId: partner.userId,
    name: partner.user.name,
    email: partner.user.email,
    phone: partner.user.phone,
    vehicleType: partner.vehicleType,
    vehicleNumber: partner.vehicleNumber,
    isAvailable: partner.isAvailable,
    isVerified: partner.isVerified,
    isActive: partner.user.isActive,
    activeAssignments,
    totalDeliveries: partner.totalDeliveries,
    earnings: partner.earnings.toFixed(2),
    lastLoginAt: partner.user.lastLoginAt,
    createdAt: partner.user.createdAt,
  };
}

async function withActiveCount(partner: AdminPartner) {
  const count = await repo.countActiveAssignments(partner.userId);
  return serializePartner(partner, count);
}

function notifyWelcome(input: CreatePartnerInput): void {
  void sendDeliveryPartnerWelcomeEmail({
    to: input.email,
    name: input.name,
    password: input.password,
  }).catch((error: unknown) => {
    logger.error('Could not send delivery partner welcome email', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });
}

export const deliveryPartnerAdminService = {
  async list(query: ListPartnersQuery) {
    const pagination = getPaginationParams(query.page, query.limit, 20, 50);
    const [partners, total] = await repo.list({
      ...query,
      page: pagination.page,
      limit: pagination.limit,
    });
    const counts = await repo.activeAssignmentCounts(
      partners.map((partner) => partner.userId),
    );
    const countMap = new Map(
      counts.map((row) => [row.deliveryPartnerId, row._count._all]),
    );
    return {
      data: partners.map((partner) =>
        serializePartner(partner, countMap.get(partner.userId) ?? 0),
      ),
      pagination: getPaginationMeta(
        pagination.page,
        pagination.limit,
        total,
      ),
    };
  },

  async create(input: CreatePartnerInput) {
    const existing = await repo.findUserByEmail(input.email);
    if (existing) {
      throw new AppError(
        'An account with this email already exists',
        409,
        'EMAIL_IN_USE',
      );
    }
    const password = await hashPassword(input.password);
    try {
      const partner = await repo.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        password,
        vehicleType: input.vehicleType,
        vehicleNumber: input.vehicleNumber,
      });
      notifyWelcome(input);
      logger.info('Delivery partner created', {
        userId: partner.userId,
        email: input.email,
      });
      return serializePartner(partner);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'An account with this email already exists',
          409,
          'EMAIL_IN_USE',
        );
      }
      throw error;
    }
  },

  async update(userId: string, input: UpdatePartnerInput) {
    const existing = await repo.findById(userId);
    if (!existing) {
      throw new AppError('Delivery partner not found', 404, 'RIDER_NOT_FOUND');
    }
    const userData: Prisma.UserUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    };
    const profileData: Prisma.DeliveryPartnerUpdateInput = {
      ...(input.vehicleType !== undefined
        ? { vehicleType: input.vehicleType }
        : {}),
      ...(input.vehicleNumber !== undefined
        ? { vehicleNumber: input.vehicleNumber }
        : {}),
      ...(input.isAvailable !== undefined
        ? { isAvailable: input.isAvailable }
        : {}),
    };
    const partner = await repo.update(userId, userData, profileData);
    return withActiveCount(partner);
  },

  async verify(userId: string, input: VerifyPartnerInput) {
    const existing = await repo.findById(userId);
    if (!existing) {
      throw new AppError('Delivery partner not found', 404, 'RIDER_NOT_FOUND');
    }
    const partner = await repo.update(
      userId,
      {},
      { isVerified: input.isVerified },
    );
    logger.info('Delivery partner verification changed', {
      userId,
      isVerified: input.isVerified,
    });
    return withActiveCount(partner);
  },

  async deactivate(userId: string) {
    const existing = await repo.findById(userId);
    if (!existing) {
      throw new AppError('Delivery partner not found', 404, 'RIDER_NOT_FOUND');
    }
    const activeAssignments = await repo.countActiveAssignments(userId);
    if (activeAssignments > 0) {
      throw new AppError(
        'Reassign this partner’s active orders before deactivating the account',
        409,
        'RIDER_HAS_ACTIVE_ORDERS',
        { activeAssignments },
      );
    }
    const partner = await repo.setActive(userId, false);
    logger.info('Delivery partner deactivated', { userId });
    return withActiveCount(partner);
  },
};
