import { z } from 'zod';

export const assignmentQuerySchema = z.object({
  status: z
    .enum(['all', 'active', 'new', 'ready', 'completed'])
    .default('all'),
});

export const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const earningsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'all']).default('today'),
});

export const completeAssignmentSchema = z
  .object({
    proof: z
      .object({
        type: z.enum(['photo', 'otp']),
        value: z.string().trim().min(1).max(500),
      })
      .optional(),
  })
  .default({});

export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type EarningsQuery = z.infer<typeof earningsQuerySchema>;
export type CompleteAssignmentInput = z.infer<
  typeof completeAssignmentSchema
>;
