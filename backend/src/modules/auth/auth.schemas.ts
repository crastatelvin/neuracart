import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{9,14}$/, 'Enter a valid phone number')
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.phone !== undefined, {
    message: 'Provide a name or phone number',
  });

export const deliveryLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type DeliveryLoginInput = z.infer<typeof deliveryLoginSchema>;
