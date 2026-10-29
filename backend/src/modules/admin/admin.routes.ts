import { Role } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import { statsQuerySchema } from './admin.schemas';
import * as statsController from './stats.controller';
import * as partnerController from './deliveryPartner.controller';
import {
  createPartnerSchema,
  listPartnersQuerySchema,
  updatePartnerSchema,
  verifyPartnerSchema,
} from './deliveryPartner.schemas';
import { upiQueueHandler, upiVerifyHandler } from '../money/money.routes';
import { z } from 'zod';

const upiVerifySchema = z.object({
  approved: z.boolean().default(true),
});

export const adminRoutes = Router();

adminRoutes.use(authenticate, authorize(Role.ADMIN));

adminRoutes.get(
  '/stats',
  validateQuery(statsQuerySchema),
  statsController.getStats,
);

adminRoutes.get(
  '/delivery-partners',
  validateQuery(listPartnersQuerySchema),
  partnerController.listPartners,
);
adminRoutes.post(
  '/delivery-partners',
  validateBody(createPartnerSchema),
  partnerController.createPartner,
);
adminRoutes.patch(
  '/delivery-partners/:id/verify',
  validateBody(verifyPartnerSchema),
  partnerController.verifyPartner,
);
adminRoutes.patch(
  '/delivery-partners/:id/deactivate',
  partnerController.deactivatePartner,
);
adminRoutes.patch(
  '/delivery-partners/:id',
  validateBody(updatePartnerSchema),
  partnerController.updatePartner,
);

// ——— UPI intent-flow review queue (P4) ———
adminRoutes.get('/upi-queue', upiQueueHandler);
adminRoutes.post(
  '/orders/:orderId/verify-upi',
  validateBody(upiVerifySchema),
  upiVerifyHandler,
);
