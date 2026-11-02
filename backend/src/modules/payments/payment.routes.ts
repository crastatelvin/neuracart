import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from '../../services/razorpay.service';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { sendSuccess } from '../../utils/response';

const createSchema = z.object({
  orderId: z.string().uuid(),
});

const createHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const { orderId } = req.body as z.infer<typeof createSchema>;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    if (order.customerId !== req.user.id) {
      throw new AppError('This order does not belong to you', 403, 'FORBIDDEN');
    }
    if (order.paymentStatus === 'PAID') {
      throw new AppError('Order is already paid', 409, 'ALREADY_PAID');
    }
    const razorpay = await createRazorpayOrder({
      amountInr: Number(order.total),
      receipt: order.orderNumber,
      notes: { orderId: order.id },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: razorpay.id, paymentMethod: 'ONLINE' },
    });
    sendSuccess(
      res,
      { ...razorpay, keyId: env.RAZORPAY_KEY_ID },
      'Razorpay order created',
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const paymentRoutes = Router();

paymentRoutes.get('/razorpay/status', (_req, res) => {
  sendSuccess(res, { configured: isRazorpayConfigured() }, 'Payments');
});

paymentRoutes.post(
  '/razorpay/order',
  authenticate,
  validateBody(createSchema),
  createHandler,
);

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { order_id?: string; notes?: { orderId?: string } } };
    order?: { entity?: { notes?: { orderId?: string } } };
  };
};

/**
 * Razorpay webhook. Raw body is required for the HMAC check, so this route is
 * mounted before the global JSON parser in app.ts.
 */
paymentRoutes.post(
  '/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const signature = req.header('x-razorpay-signature');
    if (!verifyRazorpaySignature(raw, signature)) {
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    let event: RazorpayEvent;
    try {
      event = JSON.parse(raw) as RazorpayEvent;
    } catch {
      res.status(400).json({ success: false, message: 'Invalid payload' });
      return;
    }

    const orderId =
      event.payload?.payment?.entity?.notes?.orderId ??
      event.payload?.order?.entity?.notes?.orderId;

    if (orderId && ['payment.captured', 'order.paid'].includes(event.event ?? '')) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order && order.paymentStatus !== 'PAID') {
        await prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              paymentRef:
                event.payload?.payment?.entity?.order_id ?? order.paymentRef,
            },
          }),
          prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: order.status,
              note: 'Razorpay payment captured',
              changedBy: order.customerId,
            },
          }),
        ]);
        logger.info('Razorpay payment captured', { orderId: order.id });
      }
    }

    sendSuccess(res, { received: true }, 'Webhook processed');
  },
);
