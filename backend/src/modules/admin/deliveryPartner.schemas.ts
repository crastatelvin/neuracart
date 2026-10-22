import { z } from 'zod';

const booleanFilter = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const vehicleType = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .transform((value) => value.toUpperCase());

const vehicleNumber = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .transform((value) => value.toUpperCase());

export const listPartnersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(120).optional(),
  available: booleanFilter.optional(),
  verified: booleanFilter.optional(),
});

export const createPartnerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8).max(128),
  vehicleType,
  vehicleNumber,
});

export const updatePartnerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(8).max(20),
    vehicleType,
    vehicleNumber,
    isAvailable: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const verifyPartnerSchema = z.object({
  isVerified: z.boolean().default(true),
});

export type ListPartnersQuery = z.infer<typeof listPartnersQuerySchema>;
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type VerifyPartnerInput = z.infer<typeof verifyPartnerSchema>;
