import type { Response } from 'express';

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
};

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: Pagination,
  message = 'Success',
): Response {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown,
  code = 'REQUEST_ERROR',
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors === undefined ? {} : { errors }),
    requestId: res.locals.requestId as string | undefined,
  });
}

export function getPaginationParams(
  page?: unknown,
  limit?: unknown,
  defaultLimit = 20,
  maxLimit = 100,
): PaginationParams {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  const safePage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), maxLimit)
      : defaultLimit;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

export function getPaginationMeta(
  page: number,
  limit: number,
  total: number,
): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
