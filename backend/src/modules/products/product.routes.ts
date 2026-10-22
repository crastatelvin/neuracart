import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadRateLimiter } from '../../middleware/rateLimiter';
import { productImageUpload } from '../../middleware/upload';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './product.controller';
import {
  productCreateSchema,
  productListQuerySchema,
  productUpdateSchema,
} from './product.schemas';

export const productRoutes = Router();

productRoutes.get(
  '/',
  validateQuery(productListQuerySchema),
  controller.list,
);
productRoutes.get('/featured', controller.featured);
productRoutes.get('/:id', controller.getById);

productRoutes.post(
  '/',
  authenticate,
  authorize(Role.ADMIN),
  uploadRateLimiter,
  productImageUpload.single('image'),
  validateBody(productCreateSchema),
  controller.create,
);
productRoutes.patch(
  '/:id/toggle',
  authenticate,
  authorize(Role.ADMIN),
  controller.toggle,
);
productRoutes.patch(
  '/:id',
  authenticate,
  authorize(Role.ADMIN),
  uploadRateLimiter,
  productImageUpload.single('image'),
  validateBody(productUpdateSchema),
  controller.update,
);
productRoutes.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN),
  controller.remove,
);
