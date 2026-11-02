import { Role } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './delivery.controller';
import {
  assignmentQuerySchema,
  availabilitySchema,
  completeAssignmentSchema,
  earningsQuerySchema,
} from './delivery.schemas';
import { deliveryLogisticsRoutes } from '../logistics/logistics.routes';

export const deliveryRoutes = Router();

deliveryRoutes.use(authenticate, authorize(Role.DELIVERY_PARTNER));

deliveryRoutes.get(
  '/assignments',
  validateQuery(assignmentQuerySchema),
  controller.listAssignments,
);
deliveryRoutes.patch(
  '/assignments/:id/accept',
  controller.acceptAssignment,
);
deliveryRoutes.patch(
  '/assignments/:id/reject',
  controller.rejectAssignment,
);
deliveryRoutes.patch(
  '/assignments/:id/start',
  controller.startAssignment,
);
deliveryRoutes.patch(
  '/assignments/:id/complete',
  validateBody(completeAssignmentSchema),
  controller.completeAssignment,
);
deliveryRoutes.get(
  '/earnings',
  validateQuery(earningsQuerySchema),
  controller.getEarnings,
);
deliveryRoutes.get('/profile', controller.getProfile);
deliveryRoutes.patch(
  '/availability',
  validateBody(availabilitySchema),
  controller.updateAvailability,
);
deliveryRoutes.use('/', deliveryLogisticsRoutes);
