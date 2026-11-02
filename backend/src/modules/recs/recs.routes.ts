import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { optionalAuthenticate } from '../../middleware/optionalAuthenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { recsService } from './recs.service';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { param } from '../../utils/request';
import { adminRecipeRoutes } from './recipe.admin.routes';

export const recsRoutes = Router();

const idsSchema = z.object({
  productIds: z.array(z.string().uuid()).max(20).default([]),
});

type IdsBody = z.infer<typeof idsSchema>;

function actor(req: RequestHandler extends never ? never : import('express').Request) {
  if (!req.user) throw new Error('authenticate middleware did not attach a user');
  return req.user;
}

const homeHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = actor(req);
    const { productIds } = req.body as IdsBody;
    const feed = await recsService.home(user.id, productIds);
    sendSuccess(res, feed, 'Personalised feed');
  } catch (error) {
    next(error);
  }
};

const reorderHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = actor(req);
    const reorder = await recsService.reorder(user.id);
    sendSuccess(res, reorder, 'Reorder suggestions');
  } catch (error) {
    next(error);
  }
};

const togetherHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = actor(req);
    const { productIds } = req.body as IdsBody;
    const cards = await recsService.together(productIds, user.id);
    sendSuccess(res, cards, 'Goes well with');
  } catch (error) {
    next(error);
  }
};

const recipesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const recipes = await recsService.recipes();
    sendSuccess(res, recipes, 'Recipes');
  } catch (error) {
    next(error);
  }
};

const recipeById: RequestHandler = async (req, res, next) => {
  try {
    const key = param(req, 'idOrSlug');
    const recipe = await prisma.recipe.findFirst({
      where: {
        OR: [{ id: key }, { slug: key }],
        isPublished: true,
      },
      include: { items: { include: { product: true } } },
    });
    if (!recipe) {
      throw new AppError('Recipe not found', 404, 'RECIPE_NOT_FOUND');
    }
    sendSuccess(res, recipe, 'Recipe');
  } catch (error) {
    next(error);
  }
};

const addRecipeToCartSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
});

type RecipeCartBody = z.infer<typeof addRecipeToCartSchema>;

const cartForRecipe: RequestHandler = async (req, res, next) => {
  try {
    const { productIds } = req.body as RecipeCartBody;
    const recipe = await prisma.recipe.findFirst({
      where: { id: param(req, 'id'), isPublished: true },
      include: { items: true },
    });
    if (!recipe) {
      throw new AppError('Recipe not found', 404, 'RECIPE_NOT_FOUND');
    }
    const items = recipe.items
      .filter((item) => productIds.includes(item.productId))
      .map((item) => ({ productId: item.productId, quantity: item.quantity }));
    sendSuccess(res, items, 'Recipe cart items');
  } catch (error) {
    next(error);
  }
};

recsRoutes.get('/recipes', optionalAuthenticate, recipesHandler);
recsRoutes.get('/recipes/:idOrSlug', optionalAuthenticate, recipeById);
recsRoutes.post(
  '/recipes/:id/cart',
  authenticate,
  authorize(Role.CUSTOMER),
  validateBody(addRecipeToCartSchema),
  cartForRecipe,
);
recsRoutes.post(
  '/home',
  authenticate,
  authorize(Role.CUSTOMER),
  validateBody(idsSchema),
  homeHandler,
);
recsRoutes.get('/reorder', authenticate, authorize(Role.CUSTOMER), reorderHandler);
recsRoutes.post(
  '/together',
  authenticate,
  authorize(Role.CUSTOMER),
  validateBody(idsSchema),
  togetherHandler,
);

recsRoutes.use('/admin/recipes', authenticate, authorize(Role.ADMIN), adminRecipeRoutes);
