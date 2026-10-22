import { Role } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import * as controller from './store.controller';
import { updateStoreSchema } from './store.schemas';

export const storeRoutes = Router();

storeRoutes.get('/', controller.getStore);
storeRoutes.patch(
  '/',
  authenticate,
  authorize(Role.ADMIN),
  validateBody(updateStoreSchema),
  controller.updateStore,
);
