import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response';
import { statsService } from './stats.service';
import type { StatsQuery } from './admin.schemas';

export const getStats: RequestHandler = async (req, res, next) => {
  try {
    const stats = await statsService.getStats(
      req.validatedQuery as StatsQuery,
    );
    sendSuccess(res, stats, 'Dashboard stats fetched');
  } catch (error) {
    next(error);
  }
};
