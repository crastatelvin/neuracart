import { Prisma } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../utils/errors';
import { param } from '../../utils/request';
import { sendSuccess } from '../../utils/response';

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(50),
  note: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, 'Use lowercase letters, numbers and dashes'),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  servings: z.coerce.number().int().min(1).max(12).default(2),
  imageUrl: z.string().trim().max(500).optional(),
  steps: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  isPublished: z.boolean().default(true),
  items: z.array(itemSchema).min(1).max(20),
});

const updateSchema = createSchema.partial();

const list: RequestHandler = async (_req, res, next) => {
  try {
    const recipes = await prisma.recipe.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, unit: true, price: true } } },
        },
      },
    });
    sendSuccess(res, recipes, 'Recipes');
  } catch (error) {
    next(error);
  }
};

const create: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createSchema>;
    const recipe = await prisma.recipe.create({
      data: {
        slug: body.slug,
        title: body.title,
        description: body.description ?? null,
        servings: body.servings,
        imageUrl: body.imageUrl ?? null,
        steps: body.steps,
        isPublished: body.isPublished,
        items: {
          create: body.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            note: item.note ?? null,
          })),
        },
      },
      include: { items: true },
    });
    sendSuccess(res, recipe, 'Recipe created', 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      next(new AppError('That slug is already in use', 409, 'SLUG_TAKEN'));
      return;
    }
    next(error);
  }
};

const update: RequestHandler = async (req, res, next) => {
  try {
    const id = param(req, 'id');
    const body = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new AppError('Recipe not found', 404, 'RECIPE_NOT_FOUND');

    const recipe = await prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.recipeItem.deleteMany({ where: { recipeId: id } });
      }
      return tx.recipe.update({
        where: { id },
        data: {
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.servings !== undefined ? { servings: body.servings } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
          ...(body.steps !== undefined ? { steps: body.steps } : {}),
          ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
          ...(body.items
            ? {
                items: {
                  create: body.items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    note: item.note ?? null,
                  })),
                },
              }
            : {}),
        },
        include: { items: true },
      });
    });
    sendSuccess(res, recipe, 'Recipe updated');
  } catch (error) {
    next(error);
  }
};

const remove: RequestHandler = async (req, res, next) => {
  try {
    const id = param(req, 'id');
    await prisma.recipe.delete({ where: { id } });
    sendSuccess(res, { id }, 'Recipe deleted');
  } catch (error) {
    next(error);
  }
};

/** Mounted under /api/recs/admin with admin auth already enforced. */
export const adminRecipeRoutes = Router();
adminRecipeRoutes.get('/', list);
adminRecipeRoutes.post('/', validateBody(createSchema), create);
adminRecipeRoutes.patch('/:id', validateBody(updateSchema), update);
adminRecipeRoutes.delete('/:id', remove);
