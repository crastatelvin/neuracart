import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { schedulingService } from './scheduling.service';

export const schedulingRoutes = Router();

const slotsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(7).default(3),
});

const slotsHandler: RequestHandler = async (req, res, next) => {
  try {
    const { days } = req.validatedQuery as unknown as z.infer<typeof slotsQuerySchema>;
    const slots = await schedulingService.listSlots(days);
    sendSuccess(res, slots, 'Delivery slots');
  } catch (error) {
    next(error);
  }
};

const subscriptionsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const subs = await schedulingService.listSubscriptions(req.user.id);
    sendSuccess(res, subs, 'Subscriptions');
  } catch (error) {
    next(error);
  }
};

const subscriptionCreateSchema = z.object({
  addressId: z.string().uuid(),
  cadenceDays: z.coerce.number().int().min(7).max(28),
  dayOfWeek: z.coerce.number().int().min(0).max(6).default(0),
  notes: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
});

const subscriptionCreateHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const body = req.body as z.infer<typeof subscriptionCreateSchema>;
    const sub = await schedulingService.createSubscription(req.user.id, body);
    sendSuccess(res, sub, 'Subscription created');
  } catch (error) {
    next(error);
  }
};

const subscriptionUpdateSchema = z.object({
  status: z.enum(['PAUSED', 'ACTIVE', 'CANCELLED']).optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
});

const subscriptionUpdateHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const id = String(req.params?.id ?? '');
    if (!z.string().uuid().safeParse(id).success) {
      throw new AppError('Invalid subscription id', 422, 'INVALID_ID');
    }
    const body = req.body as z.infer<typeof subscriptionUpdateSchema>;
    const sub = await schedulingService.updateSubscription(req.user.id, id, body);
    sendSuccess(res, sub, 'Subscription updated');
  } catch (error) {
    next(error);
  }
};

const bulkSlotsSchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(14),
});

const bulkSlotsHandler: RequestHandler = async (req, res, next) => {
  try {
    const { days } = req.body as z.infer<typeof bulkSlotsSchema>;
    const result = await schedulingService.bulkSlots(days);
    sendSuccess(res, result, 'Slots ready');
  } catch (error) {
    next(error);
  }
};

const runSubscriptionsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const result = await schedulingService.runDueSubscriptions();
    sendSuccess(res, result, 'Subscription runner finished');
  } catch (error) {
    next(error);
  }
};

const adminSlotsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const slots = await schedulingService.listSlots(7);
    sendSuccess(res, slots, 'Delivery slots');
  } catch (error) {
    next(error);
  }
};

const adminSubscriptionsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const subs = await listAllSubscriptions();
    sendSuccess(res, subs, 'All subscriptions');
  } catch (error) {
    next(error);
  }
};

async function listAllSubscriptions() {
  const subs = await prisma.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: { select: { name: true, email: true } },
      address: { select: { label: true, line1: true, city: true } },
    },
  });
  return subs.map((sub) => ({
    id: sub.id,
    status: sub.status,
    cadenceDays: sub.cadenceDays,
    dayOfWeek: sub.dayOfWeek,
    nextRunAt: sub.nextRunAt,
    lastRunAt: sub.lastRunAt,
    user: sub.user.name ?? sub.user.email,
    address: sub.address,
    itemCount: (sub.items as Array<unknown>).length,
  }));
}

// ——— customer ———
schedulingRoutes.use('/slots', authenticate);
schedulingRoutes.use('/subscriptions', authenticate);
schedulingRoutes.use('/admin', authenticate);
schedulingRoutes.get('/slots', authorize(Role.CUSTOMER), validateQuery(slotsQuerySchema), slotsHandler);
schedulingRoutes.get('/subscriptions', authorize(Role.CUSTOMER), subscriptionsHandler);
schedulingRoutes.post(
  '/subscriptions',
  authorize(Role.CUSTOMER),
  validateBody(subscriptionCreateSchema),
  subscriptionCreateHandler,
);
schedulingRoutes.patch(
  '/subscriptions/:id',
  authorize(Role.CUSTOMER),
  validateBody(subscriptionUpdateSchema),
  subscriptionUpdateHandler,
);

// ——— admin (also mounted under /api/admin) ———
schedulingRoutes.get('/admin/slots', authorize(Role.ADMIN), adminSlotsHandler);
schedulingRoutes.post('/admin/slots/bulk', authorize(Role.ADMIN), validateBody(bulkSlotsSchema), bulkSlotsHandler);
schedulingRoutes.post('/admin/subscriptions/run', authorize(Role.ADMIN), runSubscriptionsHandler);
schedulingRoutes.get('/admin/subscriptions', authorize(Role.ADMIN), adminSubscriptionsHandler);

export {};
