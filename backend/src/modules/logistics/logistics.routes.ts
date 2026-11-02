import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { productImageUpload } from '../../middleware/upload';
import { uploadRateLimiter } from '../../middleware/rateLimiter';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../utils/errors';
import { param } from '../../utils/request';
import { sendSuccess } from '../../utils/response';
import { logisticsService } from './logistics.service';

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

const proofSchema = z.object({
  otp: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit delivery code'),
});

const batchSchema = z.object({
  orderIds: z.array(z.string().uuid()).length(2),
});

const weatherSchema = z.object({
  mode: z.enum(['NORMAL', 'RAIN', 'HEAVY']),
  note: z.string().trim().max(200).optional(),
  surgeFee: z.coerce.number().min(0).max(200).default(0),
});

const updateLocation: RequestHandler = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body as z.infer<typeof locationSchema>;
    const result = await logisticsService.updateLocation(
      req.user!.id,
      latitude,
      longitude,
    );
    sendSuccess(res, result, 'Location updated');
  } catch (error) {
    next(error);
  }
};

const weather: RequestHandler = async (_req, res, next) => {
  try {
    sendSuccess(res, await logisticsService.weather(), 'Weather');
  } catch (error) {
    next(error);
  }
};

const batch: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await logisticsService.riderBatch(req.user!.id), 'Batch');
  } catch (error) {
    next(error);
  }
};

const sendProofOtp: RequestHandler = async (req, res, next) => {
  try {
    const result = await logisticsService.sendProofOtp(
      param(req, 'id'),
      req.user!.id,
    );
    sendSuccess(res, result, 'Delivery code sent');
  } catch (error) {
    next(error);
  }
};

const verifyProof: RequestHandler = async (req, res, next) => {
  try {
    const { otp } = req.body as z.infer<typeof proofSchema>;
    const result = await logisticsService.verifyProof(
      param(req, 'id'),
      req.user!.id,
      otp,
      req.file,
    );
    sendSuccess(res, result, 'Delivery verified');
  } catch (error) {
    next(error);
  }
};

const dispatch: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await logisticsService.dispatchSuggestions(param(req, 'id')),
      'Dispatch suggestions',
    );
  } catch (error) {
    next(error);
  }
};

const createBatch: RequestHandler = async (req, res, next) => {
  try {
    const { orderIds } = req.body as z.infer<typeof batchSchema>;
    sendSuccess(res, await logisticsService.createBatch(orderIds), 'Batch created', 201);
  } catch (error) {
    next(error);
  }
};

const setWeather: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof weatherSchema>;
    sendSuccess(res, await logisticsService.setWeather(body), 'Weather updated');
  } catch (error) {
    next(error);
  }
};

/** Mounted inside deliveryRoutes, so auth + rider role are already enforced. */
export const deliveryLogisticsRoutes = Router();
deliveryLogisticsRoutes.patch('/location', validateBody(locationSchema), updateLocation);
deliveryLogisticsRoutes.get('/weather', weather);
deliveryLogisticsRoutes.get('/batch', batch);
deliveryLogisticsRoutes.post('/assignments/:id/proof/send', sendProofOtp);
deliveryLogisticsRoutes.post(
  '/assignments/:id/proof',
  uploadRateLimiter,
  productImageUpload.single('photo'),
  (req, res, next) => {
    if (!req.file) {
      next(new AppError('A proof photo is required', 422, 'PHOTO_REQUIRED'));
      return;
    }
    validateBody(proofSchema)(req, res, next);
  },
  verifyProof,
);

/** Mounted inside adminRoutes. */
export const adminLogisticsRoutes = Router();
adminLogisticsRoutes.get('/orders/:id/dispatch', dispatch);
adminLogisticsRoutes.post('/rider-batches', validateBody(batchSchema), createBatch);
adminLogisticsRoutes.get('/store/weather', weather);
adminLogisticsRoutes.post('/store/weather', validateBody(weatherSchema), setWeather);
