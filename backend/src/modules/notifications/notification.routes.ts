import { PushPlatform } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../middleware/validate';
import {
  registerPushToken,
  removePushToken,
} from '../../services/push.service';
import { whatsappConfigured } from '../../services/whatsapp.service';
import { sendSuccess } from '../../utils/response';

const tokenSchema = z.object({
  token: z.string().trim().min(8).max(300),
  platform: z.nativeEnum(PushPlatform).default(PushPlatform.ANDROID),
});

const register: RequestHandler = async (req, res, next) => {
  try {
    const { token, platform } = req.body as z.infer<typeof tokenSchema>;
    await registerPushToken({ userId: req.user!.id, token, platform });
    sendSuccess(
      res,
      { registered: true, whatsapp: whatsappConfigured() },
      'Push token registered',
    );
  } catch (error) {
    next(error);
  }
};

const unregister: RequestHandler = async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    if (token) await removePushToken(token);
    sendSuccess(res, { removed: Boolean(token) }, 'Push token removed');
  } catch (error) {
    next(error);
  }
};

export const notificationRoutes = Router();
notificationRoutes.post('/push-token', authenticate, validateBody(tokenSchema), register);
notificationRoutes.delete('/push-token', authenticate, unregister);
