import { z } from 'zod';

const category = z
  .enum(['fruits', 'vegetables', 'meat'])
  .transform((value) => value.toUpperCase() as 'FRUITS' | 'VEGETABLES' | 'MEAT');

const booleanish = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value;
}, z.boolean().optional());

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: category.optional(),
  featured: booleanish,
  search: z.string().trim().max(80).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  category,
  price: z.coerce.number().positive().max(100000),
  unit: z.string().trim().min(1).max(30),
  stock: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: booleanish,
  isFeatured: booleanish,
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  category: category.optional(),
  price: z.coerce.number().positive().max(100000).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  stock: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: booleanish,
  isFeatured: booleanish,
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
