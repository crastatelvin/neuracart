import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestContext = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
  };

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { ...requestContext, error: err });
    } else {
      logger.warn(err.message, {
        ...requestContext,
        errorCode: err.code,
        statusCode: err.statusCode,
      });
    }
    sendError(res, err.message, err.statusCode, err.details, err.code);
    return;
  }

  if (err instanceof TokenExpiredError) {
    sendError(res, 'Token expired', 401, undefined, 'TOKEN_EXPIRED');
    return;
  }

  if (err instanceof JsonWebTokenError) {
    sendError(res, 'Invalid token', 401, undefined, 'INVALID_TOKEN');
    return;
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    sendError(res, 'Validation failed', 422, errors, 'VALIDATION_ERROR');
    return;
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum size is ${env.MAX_FILE_SIZE_MB} MB.`
        : `Upload failed: ${err.message}`;
    sendError(res, message, status, undefined, err.code);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(', ')
        : String(err.meta?.target ?? 'field');
      sendError(
        res,
        `A record with this ${target} already exists`,
        409,
        undefined,
        'DUPLICATE_RECORD',
      );
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 'Record not found', 404, undefined, 'NOT_FOUND');
      return;
    }
    if (err.code === 'P2003') {
      sendError(
        res,
        'This record is still referenced by other data',
        400,
        undefined,
        'FOREIGN_KEY_CONSTRAINT',
      );
      return;
    }
    logger.error('Prisma request error', {
      ...requestContext,
      code: err.code,
      error: err,
    });
    sendError(res, 'Database request failed', 500, undefined, 'DATABASE_ERROR');
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', {
      ...requestContext,
      error: err,
    });
    sendError(res, 'Invalid database query', 500, undefined, 'DATABASE_ERROR');
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 'Invalid JSON body', 400, undefined, 'INVALID_JSON');
    return;
  }

  const error = err instanceof Error ? err : new Error('Unknown error');
  logger.error('Unhandled request error', {
    ...requestContext,
    error,
  });

  sendError(
    res,
    env.isProd ? 'Something went wrong' : error.message,
    500,
    env.isDev ? { debug: error.message } : undefined,
    'INTERNAL_ERROR',
  );
};
