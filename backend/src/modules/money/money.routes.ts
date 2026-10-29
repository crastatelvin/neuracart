import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { moneyService } from './money.service';

export const moneyRoutes = Router();

const referralSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

const walletHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const wallet = await moneyService.wallet(req.user.id);
    sendSuccess(res, wallet, 'Wallet');
  } catch (error) {
    next(error);
  }
};

const loyaltyHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const loyalty = await moneyService.loyalty(req.user.id);
    sendSuccess(res, loyalty, 'Loyalty');
  } catch (error) {
    next(error);
  }
};

const referralGetHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const referral = await moneyService.referral(req.user.id);
    sendSuccess(res, referral, 'Referrals');
  } catch (error) {
    next(error);
  }
};

const referralApplyHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const { code } = req.body as z.infer<typeof referralSchema>;
    const result = await moneyService.applyReferral(req.user.id, code);
    sendSuccess(res, result, 'Referral credited');
  } catch (error) {
    next(error);
  }
};

// ——— admin UPI review queue (mounted from /api/admin) ———

export const upiQueueHandler: RequestHandler = async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        paymentMethod: 'ONLINE',
        paymentStatus: 'PENDING',
        paymentRef: { startsWith: 'upi-acked' },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paymentRef: true,
        createdAt: true,
        customer: { select: { name: true, email: true } },
      },
    });
    sendSuccess(
      res,
      orders.map((order) => ({
        ...order,
        total: Number(order.total),
        paymentRef: order.paymentRef ?? '',
      })),
      'UPI payments awaiting review',
    );
  } catch (error) {
    next(error);
  }
};

const upiVerifySchema = z.object({
  approved: z.boolean().default(true),
});

export const upiVerifyHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const orderId = String(req.params?.orderId ?? '');
    const { approved } = req.body as z.infer<typeof upiVerifySchema>;
    const paymentMethodSchema = z.string().uuid();
    if (!paymentMethodSchema.safeParse(orderId).success) {
      throw new AppError('Invalid order id', 422, 'INVALID_ID');
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    if (order.paymentMethod !== 'ONLINE') {
      throw new AppError('This order is not a UPI payment', 409, 'NOT_UPI_ORDER');
    }
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: approved ? 'PAID' : 'FAILED',
        ...(approved && order.status === 'PENDING'
          ? { status: 'CONFIRMED' } : {}),
      },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: updated.status,
        note: approved ? 'UPI payment verified by admin' : 'UPI payment rejected by admin',
        changedBy: req.user.id,
      },
    });
    sendSuccess(
      res,
      { id: updated.id, paymentStatus: updated.paymentStatus, status: updated.status },
      approved ? 'Payment verified' : 'Payment rejected',
    );
  } catch (error) {
    next(error);
  }
};

// ——— customer ———
moneyRoutes.use(authenticate);
moneyRoutes.get('/wallet', authorize(Role.CUSTOMER), walletHandler);
moneyRoutes.get('/loyalty', authorize(Role.CUSTOMER), loyaltyHandler);
moneyRoutes.get('/referrals', authorize(Role.CUSTOMER), referralGetHandler);
moneyRoutes.post('/referrals/apply', authorize(Role.CUSTOMER), validateBody(referralSchema), referralApplyHandler);

export {};
