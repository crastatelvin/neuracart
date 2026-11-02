import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validateQuery } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { analyticsService } from './analytics.service';

const forecastQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(14).default(7),
});

const forecastHandler: RequestHandler = async (req, res, next) => {
  try {
    const { days } = req.validatedQuery as unknown as z.infer<typeof forecastQuerySchema>;
    sendSuccess(res, await analyticsService.forecast(days), 'Forecast');
  } catch (error) {
    next(error);
  }
};

const stockAlertsHandler: RequestHandler = async (_req, res, next) => {
  try {
    sendSuccess(res, await analyticsService.stockAlerts(), 'Stock alerts');
  } catch (error) {
    next(error);
  }
};

/** Mounted inside adminRoutes, so admin auth is already enforced. */
export const adminAnalyticsRoutes = Router();
adminAnalyticsRoutes.get('/forecast', validateQuery(forecastQuerySchema), forecastHandler);
adminAnalyticsRoutes.get('/stock-alerts', stockAlertsHandler);
