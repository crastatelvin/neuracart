import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import * as controller from './address.controller';
import {
  addressCreateSchema,
  addressUpdateSchema,
} from './address.schemas';

export const addressRoutes = Router();

addressRoutes.use(authenticate, authorize(Role.CUSTOMER, Role.ADMIN));

addressRoutes.get('/', controller.list);
addressRoutes.post('/', validateBody(addressCreateSchema), controller.create);
addressRoutes.get('/:id', controller.getById);
addressRoutes.put('/:id', validateBody(addressUpdateSchema), controller.update);
addressRoutes.patch('/:id/default', controller.setDefault);
addressRoutes.delete('/:id', controller.remove);
