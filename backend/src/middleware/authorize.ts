import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'NO_TOKEN'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Forbidden role attempt', {
        requestId: req.id,
        userId: req.user.id,
        role: req.user.role,
        path: req.originalUrl,
        method: req.method,
      });
      next(new AppError('You do not have permission to do this', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}
