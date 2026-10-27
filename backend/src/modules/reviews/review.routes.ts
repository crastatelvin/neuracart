import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { param } from '../../utils/request';
import { prisma } from '../../config/prisma';

export const reviewRoutes = Router();

const createSchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

const adminListSchema = z.object({
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const replySchema = z.object({
  response: z.string().trim().min(3).max(500),
});

const productReviews: RequestHandler = async (req, res, next) => {
  try {
    const productId = param(req, 'productId');
    const reviews = await prisma.productReview.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { name: true } } },
    });
    const summary = reviews.length
      ? {
          count: reviews.length,
          average:
            reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
        }
      : { count: 0, average: null };
    sendSuccess(
      res,
      {
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          response: review.response,
          isVerified: review.isVerified,
          createdAt: review.createdAt,
          author: review.user.name ?? 'LocalMart customer',
        })),
        summary: {
          count: summary.count,
          average: summary.average === null ? null : Number(summary.average.toFixed(2)),
        },
      },
      'Product reviews',
    );
  } catch (error) {
    next(error);
  }
};

const mine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate missing');
    const reviews = await prisma.productReview.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { product: { select: { name: true } } },
    });
    sendSuccess(res, reviews, 'Your reviews');
  } catch (error) {
    next(error);
  }
};

const create: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate missing');
    const input = req.body as z.infer<typeof createSchema>;

    // The order must belong to the author and be delivered.
    const order = await prisma.order.findFirst({
      where: {
        id: input.orderId,
        customerId: req.user.id,
        status: 'DELIVERED',
      },
      select: { id: true, items: { select: { productId: true } } },
    });
    if (!order) {
      throw new AppError(
        'Only delivered orders can be reviewed',
        409,
        'REVIEW_ORDER_NOT_DELIVERED',
      );
    }
    if (!order.items.some((item) => item.productId === input.productId)) {
      throw new AppError(
        'You can only review products in this order',
        422,
        'REVIEW_PRODUCT_NOT_IN_ORDER',
      );
    }

    const review = await prisma.productReview.upsert({
      where: {
        orderId_productId: { orderId: input.orderId, productId: input.productId },
      },
      create: {
        orderId: input.orderId,
        productId: input.productId,
        userId: req.user.id,
        rating: input.rating,
        comment: input.comment,
        isVerified: true,
      },
      update: {
        rating: input.rating,
        comment: input.comment,
      },
    });
    sendSuccess(res, review, 'Review saved');
  } catch (error) {
    next(error);
  }
};

const adminList: RequestHandler = async (req, res, next) => {
  try {
    const query = req.validatedQuery as unknown as z.infer<typeof adminListSchema>;
    const where = query.productId ? { productId: query.productId } : {};
    const [total, reviews] = await Promise.all([
      prisma.productReview.count({ where }),
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          product: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    sendPaginated(res, reviews, {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNext: query.page < totalPages,
      hasPrev: query.page > 1,
    }, 'Reviews fetched');
  } catch (error) {
    next(error);
  }
};

const adminReply: RequestHandler = async (req, res, next) => {
  try {
    const { response } = req.body as z.infer<typeof replySchema>;
    const review = await prisma.productReview.update({
      where: { id: param(req, 'id') },
      data: { response },
    });
    sendSuccess(res, review, 'Reply saved');
  } catch (error) {
    next(error);
  }
};

// ——— customer ———
reviewRoutes.get(
  '/product/:productId',
  productReviews,
);
reviewRoutes.get('/mine', authenticate, authorize(Role.CUSTOMER), mine);
reviewRoutes.post(
  '/',
  authenticate,
  authorize(Role.CUSTOMER),
  validateBody(createSchema),
  create,
);

// ——— admin ———
reviewRoutes.get(
  '/admin',
  authenticate,
  authorize(Role.ADMIN),
  validateQuery(adminListSchema),
  adminList,
);
reviewRoutes.patch(
  '/:id/reply',
  authenticate,
  authorize(Role.ADMIN),
  validateBody(replySchema),
  adminReply,
);

export type ReviewInput = z.infer<typeof createSchema>;
