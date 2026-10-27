import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimiter';
import { validateBody } from '../../middleware/validate';
import * as controller from './auth.controller';
import {
  deliveryLoginSchema,
  prefsSchema,
  profileSchema,
  refreshSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from './auth.schemas';

export const authRoutes = Router();

authRoutes.post(
  '/send-otp',
  otpRateLimiter,
  validateBody(sendOtpSchema),
  controller.sendOtp,
);
authRoutes.post(
  '/verify-otp',
  otpRateLimiter,
  validateBody(verifyOtpSchema),
  controller.verifyOtp,
);
authRoutes.post(
  '/admin/send-otp',
  otpRateLimiter,
  validateBody(sendOtpSchema),
  controller.sendAdminOtp,
);
authRoutes.post(
  '/admin/verify-otp',
  otpRateLimiter,
  validateBody(verifyOtpSchema),
  controller.verifyAdminOtp,
);
authRoutes.post(
  '/refresh',
  authRateLimiter,
  validateBody(refreshSchema),
  controller.refresh,
);
authRoutes.post(
  '/logout',
  validateBody(refreshSchema),
  controller.logout,
);
authRoutes.post('/logout-all', authenticate, controller.logoutAll);
authRoutes.get('/me', authenticate, controller.me);
authRoutes.get('/me/prefs', authenticate, controller.prefs);
authRoutes.patch(
  '/me/prefs',
  authenticate,
  validateBody(prefsSchema),
  controller.updatePrefs,
);
authRoutes.patch(
  '/profile',
  authenticate,
  validateBody(profileSchema),
  controller.updateProfile,
);
authRoutes.post(
  '/delivery/login',
  authRateLimiter,
  validateBody(deliveryLoginSchema),
  controller.deliveryLogin,
);
