import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/errors';

type ValidationSource = 'body' | 'query' | 'params';

export function validate(
  schema: ZodType,
  source: ValidationSource = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', errors));
      return;
    }

    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req.params = result.data as typeof req.params;
    }
    next();
  };
}

export const validateBody = (schema: ZodType): RequestHandler =>
  validate(schema, 'body');
export const validateQuery = (schema: ZodType): RequestHandler =>
  validate(schema, 'query');
export const validateParams = (schema: ZodType): RequestHandler =>
  validate(schema, 'params');
