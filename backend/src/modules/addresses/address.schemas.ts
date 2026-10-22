import { z } from 'zod';

const booleanish = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value;
}, z.boolean().optional());

const addressFields = {
  label: z.string().trim().min(1).max(30),
  line1: z.string().trim().min(5).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  isDefault: booleanish,
};

export const addressCreateSchema = z.object(addressFields);

export const addressUpdateSchema = z.object({
  label: addressFields.label.optional(),
  line1: addressFields.line1.optional(),
  line2: addressFields.line2,
  city: addressFields.city.optional(),
  state: addressFields.state.optional(),
  pincode: addressFields.pincode.optional(),
  latitude: addressFields.latitude,
  longitude: addressFields.longitude,
  isDefault: addressFields.isDefault,
});

export type AddressCreateInput = z.infer<typeof addressCreateSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
