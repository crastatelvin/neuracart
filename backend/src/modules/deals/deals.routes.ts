import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { dealsService } from './deals.service';
import { AppError } from '../../utils/errors';

export const dealsRoutes = Router();

const listDealsHandler: RequestHandler = async (req, res, next) => {
  try {
    const result = await dealsService.listPublic(req.query?.page, req.query?.limit);
    sendPaginated(res, result.data, result.pagination, 'Flash deals');
  } catch (error) {
    next(error);
  }
};

const adminDealsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const deals = await dealsService.adminList();
    sendSuccess(res, deals, 'Flash deals');
  } catch (error) {
    next(error);
  }
};

const dealCreateSchema = z.object({
  productId: z.string().uuid(),
  discountPct: z.coerce.number().int().min(1).max(80),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  stockLimit: z.coerce.number().int().min(1).max(500).optional(),
});

const dealCreateHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof dealCreateSchema>;
    const deal = await dealsService.adminCreate(body);
    sendSuccess(res, deal, 'Flash deal created');
  } catch (error) {
    next(error);
  }
};

const dealUpdateSchema = z.object({
  discountPct: z.coerce.number().int().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  endsAt: z.string().min(10).optional(),
  stockLimit: z.coerce.number().int().min(0).max(900).nullable().optional(),
});

const dealUpdateHandler: RequestHandler = async (req, res, next) => {
  try {
    const id = String(req.params?.id ?? '');
    if (!z.string().uuid().safeParse(id).success) {
      throw Object.assign(new Error('Invalid deal id'), { statusCode: 422 });
    }
    const body = req.body as z.infer<typeof dealUpdateSchema>;
    const deal = await dealsService.adminUpdate(id, body);
    sendSuccess(res, deal, 'Flash deal updated');
  } catch (error) {
    next(error);
  }
};

const dealDeleteHandler: RequestHandler = async (req, res, next) => {
  try {
    const id = String(req.params?.id ?? '');
    if (!z.string().uuid().safeParse(id).success) {
      throw new AppError('Invalid deal id', 422, 'INVALID_ID');
    }
    await dealsService.adminDelete(id);
    sendSuccess(res, { id }, 'Flash deal deleted');
  } catch (error) {
    next(error);
  }
};

// ——— customer ———
dealsRoutes.get('/flash-deals', listDealsHandler);

// ——— admin (mounted under /api/admin) ———
const adminOnly = [authenticate, authorize(Role.ADMIN)];
dealsRoutes.get('/admin/flash-deals', ...adminOnly, adminDealsHandler);
dealsRoutes.post('/admin/flash-deals', ...adminOnly, validateBody(dealCreateSchema), dealCreateHandler);
dealsRoutes.patch('/admin/flash-deals/:id', ...adminOnly, validateBody(dealUpdateSchema), dealUpdateHandler);
dealsRoutes.delete('/admin/flash-deals/:id', ...adminOnly, dealDeleteHandler);

export {};
