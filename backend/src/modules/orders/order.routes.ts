import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { placeOrderRateLimiter } from '../../middleware/rateLimiter';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './order.controller';
import {
  adminOrderListQuerySchema,
  assignOrderSchema,
  cancelOrderSchema,
  upiAckSchema,
  createOrderSchema,
  customerOrderListQuerySchema,
  orderTrackingSchema,
  updateOrderStatusSchema,
} from './order.schemas';

export const orderRoutes = Router();

orderRoutes.use(authenticate);

orderRoutes.post(
  '/',
  authorize(Role.CUSTOMER),
  placeOrderRateLimiter,
  validateBody(createOrderSchema),
  controller.place,
);
orderRoutes.get(
  '/my',
  authorize(Role.CUSTOMER),
  validateQuery(customerOrderListQuerySchema),
  controller.listMy,
);
orderRoutes.get(
  '/',
  authorize(Role.ADMIN),
  validateQuery(adminOrderListQuerySchema),
  controller.adminList,
);
orderRoutes.get(
  '/:id',
  authorize(Role.CUSTOMER, Role.ADMIN, Role.DELIVERY_PARTNER),
  controller.getById,
);
orderRoutes.post(
  '/:id/cancel',
  authorize(Role.CUSTOMER, Role.ADMIN),
  validateBody(cancelOrderSchema),
  controller.cancel,
);
orderRoutes.post(
  '/:id/upi-ack',
  authorize(Role.CUSTOMER),
  validateBody(upiAckSchema),
  controller.upiAck,
);
orderRoutes.patch(
  '/:id/status',
  authorize(Role.ADMIN),
  validateBody(updateOrderStatusSchema),
  controller.updateStatus,
);
orderRoutes.patch(
  '/:id/assign',
  authorize(Role.ADMIN),
  validateBody(assignOrderSchema),
  controller.assign,
);
orderRoutes.get(
  '/:id/tracking',
  authorize(Role.CUSTOMER, Role.ADMIN, Role.DELIVERY_PARTNER),
  controller.getTracking,
);
orderRoutes.patch(
  '/:id/tracking',
  authorize(Role.ADMIN, Role.DELIVERY_PARTNER),
  validateBody(orderTrackingSchema),
  controller.updateTracking,
);
