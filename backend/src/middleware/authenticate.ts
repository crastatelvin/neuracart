import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization');
    if (!header) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }
    if (!header.startsWith('Bearer ')) {
      throw new AppError('Invalid token format', 401, 'INVALID_TOKEN_FORMAT');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('Account not found', 401, 'ACCOUNT_NOT_FOUND');
    }
    if (!user.isActive) {
      throw new AppError('Account is inactive', 401, 'ACCOUNT_INACTIVE');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (error) {
    next(error);
  }
};
