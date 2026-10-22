import { z } from 'zod';

export const statsQuerySchema = z.object({
  range: z.enum(['today', '7d', '30d']).default('today'),
});

export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type StatsRange = StatsQuery['range'];
