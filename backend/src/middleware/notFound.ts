import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors';

export const notFound: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404,
      'NOT_FOUND',
    ),
  );
};
