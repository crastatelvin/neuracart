import { randomUUID } from 'node:crypto';
import type { DeliveryPartner, User } from '@prisma/client';
import { Role } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { sendOtpEmail } from '../../services/email.service';
import { API_ROLE } from '../../utils/enums';
import { AppError } from '../../utils/errors';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import { logger } from '../../utils/logger';
import { generateOtp, getOtpExpiry, hashOtp, isExpired, verifyOtpHash } from '../../utils/otp';
import { comparePassword } from '../../utils/password';
import type { PrefsInput } from './auth.schemas';
import { authRepository as repo } from './auth.repository';

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
};

export type SafeDeliveryProfile = {
  vehicleType: string;
  vehicleNumber: string;
  isAvailable: boolean;
  isVerified: boolean;
  totalDeliveries: number;
  earnings: string;
};

export function safeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: API_ROLE[user.role],
  };
}

export function safeDeliveryProfile(
  profile: DeliveryPartner,
): SafeDeliveryProfile {
  return {
    vehicleType: profile.vehicleType,
    vehicleNumber: profile.vehicleNumber,
    isAvailable: profile.isAvailable,
    isVerified: profile.isVerified,
    totalDeliveries: profile.totalDeliveries,
    earnings: profile.earnings.toFixed(2),
  };
}

export async function issueTokens(
  user: User,
  family: string = randomUUID(),
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const refresh = signRefreshToken(user.id, family);
  await repo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refresh.token),
    family: refresh.family,
    expiresAt: refresh.expiresAt,
  });
  return { accessToken, refreshToken: refresh.token };
}

function devOtp(code: string): { devOtp?: string } {
  return env.isDev && !env.RESEND_API_KEY ? { devOtp: code } : {};
}

export const authService = {
  async sendOtp(email: string): Promise<{ devOtp?: string }> {
    let user = await repo.findUserByEmail(email);
    if (user && !user.isActive) {
      throw new AppError(
        'Your account has been deactivated',
        403,
        'ACCOUNT_INACTIVE',
      );
    }

    // The customer endpoint never escalates an admin or rider account.
    if (user && user.role !== Role.CUSTOMER) {
      return {};
    }
    if (!user) {
      user = await repo.createCustomer(email);
    }

    await repo.invalidateActiveOtps(user.id);
    const code = generateOtp();
    await repo.createOtp({
      userId: user.id,
      codeHash: hashOtp(code, user.id),
      expiresAt: getOtpExpiry(),
    });
    await sendOtpEmail(email, code);
    logger.info('Customer OTP generated', { email });
    return devOtp(code);
  },

  async sendAdminOtp(email: string): Promise<{ devOtp?: string }> {
    const user = await repo.findUserByEmail(email);
    if (!user || !user.isActive || user.role !== Role.ADMIN) {
      // Deliberately identical response for unknown, inactive and non-admin emails.
      return {};
    }

    await repo.invalidateActiveOtps(user.id);
    const code = generateOtp();
    await repo.createOtp({
      userId: user.id,
      codeHash: hashOtp(code, user.id),
      expiresAt: getOtpExpiry(),
    });
    await sendOtpEmail(email, code);
    logger.info('Admin OTP generated', { email });
    return devOtp(code);
  },

  async verifyOtp(
    email: string,
    code: string,
    expectedRole?: Role,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
  }> {
    const user = await repo.findUserByEmail(email);
    if (!user) {
      throw new AppError('Invalid or expired OTP', 400, 'OTP_INVALID');
    }
    if (!user.isActive) {
      throw new AppError(
        'Your account has been deactivated',
        403,
        'ACCOUNT_INACTIVE',
      );
    }
    if (expectedRole && user.role !== expectedRole) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const otp = await repo.findLatestActiveOtp(user.id);
    if (!otp) {
      throw new AppError('Invalid or expired OTP', 400, 'OTP_INVALID');
    }
    if (isExpired(otp.expiresAt)) {
      await repo.markOtpUsed(otp.id);
      throw new AppError('OTP expired. Request a new code.', 400, 'OTP_EXPIRED');
    }
    if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
      await repo.markOtpUsed(otp.id);
      throw new AppError(
        'Too many incorrect attempts. Request a new code.',
        401,
        'OTP_MAX_ATTEMPTS',
      );
    }

    if (!verifyOtpHash(code, user.id, otp.codeHash)) {
      const attempts = await repo.incrementOtpAttempts(otp.id);
      if (attempts >= env.OTP_MAX_ATTEMPTS) {
        await repo.markOtpUsed(otp.id);
        throw new AppError(
          'Too many incorrect attempts. Request a new code.',
          401,
          'OTP_MAX_ATTEMPTS',
        );
      }
      throw new AppError('Invalid OTP', 400, 'OTP_INVALID', {
        attemptsRemaining: env.OTP_MAX_ATTEMPTS - attempts,
      });
    }

    await repo.markOtpUsed(otp.id);
    await repo.updateLastLogin(user.id);
    const tokens = await issueTokens(user);
    logger.info('Login successful', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return { ...tokens, user: safeUser(user) };
  },

  async refresh(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = verifyRefreshToken(token);
    const stored = await repo.findRefreshTokenByHash(hashToken(token));
    if (!stored) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    if (stored.revokedAt) {
      await repo.revokeFamily(stored.family);
      logger.warn('Refresh token reuse detected', {
        userId: payload.userId,
        family: stored.family,
      });
      throw new AppError(
        'Refresh token has already been used',
        401,
        'REFRESH_REUSE',
      );
    }
    if (isExpired(stored.expiresAt)) {
      await repo.revokeRefreshTokenIfActive(stored.id);
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await repo.findUserById(payload.userId);
    if (!user || !user.isActive) {
      await repo.revokeFamily(stored.family);
      throw new AppError('Your account is inactive', 401, 'ACCOUNT_INACTIVE');
    }

    const revoked = await repo.revokeRefreshTokenIfActive(stored.id);
    if (revoked === 0) {
      await repo.revokeFamily(stored.family);
      throw new AppError(
        'Refresh token has already been used',
        401,
        'REFRESH_REUSE',
      );
    }

    return issueTokens(user, stored.family);
  },

  async logout(token: string): Promise<void> {
    try {
      verifyRefreshToken(token);
      const stored = await repo.findRefreshTokenByHash(hashToken(token));
      if (stored) {
        await repo.revokeFamily(stored.family);
      }
    } catch {
      // Logout is idempotent: an invalid or already-used token is still a logout.
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await repo.revokeAllForUser(userId);
  },

  async me(userId: string): Promise<
    SafeUser & { deliveryProfile: SafeDeliveryProfile | null }
  > {
    const user = await repo.findUserWithProfileById(userId);
    if (!user || !user.isActive) {
      throw new AppError('Account not found', 401, 'ACCOUNT_NOT_FOUND');
    }
    return {
      ...safeUser(user),
      deliveryProfile: user.deliveryProfile
        ? safeDeliveryProfile(user.deliveryProfile)
        : null,
    };
  },

  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string },
  ): Promise<SafeUser> {
    const user = await repo.findUserById(userId);
    if (!user || !user.isActive) {
      throw new AppError('Account not found', 401, 'ACCOUNT_NOT_FOUND');
    }
    const updated = await repo.updateProfile(userId, data);
    return safeUser(updated);
  },

  async getPrefs(userId: string) {
    return prisma.userPrefs.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  },

  async updatePrefs(userId: string, data: PrefsInput) {
    await prisma.userPrefs.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return prisma.userPrefs.findUniqueOrThrow({ where: { userId } });
  },

  async deliveryLogin(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
    deliveryProfile: SafeDeliveryProfile;
  }> {
    const user = await repo.findDeliveryUserByEmail(email);
    if (!user || user.role !== Role.DELIVERY_PARTNER || !user.password) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) {
      throw new AppError(
        'Your account has been deactivated',
        403,
        'ACCOUNT_INACTIVE',
      );
    }
    if (!user.deliveryProfile || !user.deliveryProfile.isVerified) {
      throw new AppError(
        'Your rider account is not verified yet',
        403,
        'RIDER_NOT_VERIFIED',
      );
    }
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    await repo.updateLastLogin(user.id);
    const tokens = await issueTokens(user);
    logger.info('Delivery partner login', {
      userId: user.id,
      email: user.email,
    });
    return {
      ...tokens,
      user: safeUser(user),
      deliveryProfile: safeDeliveryProfile(user.deliveryProfile),
    };
  },
};
