import { z } from 'zod';

const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour) time');

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().min(5).max(300),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    phone: z.string().trim().min(8).max(20),
    email: z.string().trim().email(),
    openTime: clock,
    closeTime: clock,
    deliveryFee: z.coerce.number().min(0).max(10_000),
    freeDeliveryAbove: z.coerce.number().min(0).max(100_000),
    isOpen: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one store field to update',
  });

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
