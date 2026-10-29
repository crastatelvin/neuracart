import type { Request, RequestHandler } from 'express';
import { sendPaginated, sendSuccess } from '../../utils/response';
import { param } from '../../utils/request';
import type {
  AdminOrderListQuery,
  AssignOrderInput,
  CancelOrderInput,
  CreateOrderInput,
  CustomerOrderListQuery,
  OrderTrackingInput,
  UpdateOrderStatusInput,
} from './order.schemas';
import type { UpiAckInput } from './order.schemas';
import { orderService } from './order.service';

function actor(req: Request) {
  if (!req.user) throw new Error('authenticate middleware did not attach a user');
  return req.user;
}

export const place: RequestHandler = async (req, res, next) => {
  try {
    const user = actor(req);
    const order = await orderService.place(
      user.id,
      req.body as CreateOrderInput,
      req.header('idempotency-key') ?? undefined,
    );
    sendSuccess(res, order, 'Order placed successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listMy: RequestHandler = async (req, res, next) => {
  try {
    const result = await orderService.listMy(
      actor(req).id,
      req.validatedQuery as CustomerOrderListQuery,
    );
    sendPaginated(res, result.data, result.pagination, 'Orders fetched');
  } catch (error) {
    next(error);
  }
};

export const adminList: RequestHandler = async (req, res, next) => {
  try {
    const result = await orderService.adminList(
      req.validatedQuery as AdminOrderListQuery,
    );
    sendPaginated(res, result.data, result.pagination, 'Orders fetched');
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const order = await orderService.getById(param(req, 'id'), actor(req));
    sendSuccess(res, order, 'Order fetched');
  } catch (error) {
    next(error);
  }
};

export const cancel: RequestHandler = async (req, res, next) => {
  try {
    const { reason } = req.body as CancelOrderInput;
    const order = await orderService.cancel(
      param(req, 'id'),
      actor(req),
      reason,
    );
    sendSuccess(res, order, 'Order cancelled');
  } catch (error) {
    next(error);
  }
};

export const upiAck: RequestHandler = async (req, res, next) => {
  try {
    const { upiUtrLast4 } = req.body as UpiAckInput;
    if (!req.user) throw new Error('authenticate middleware did not attach a user');
    const order = await orderService.upiAck(param(req, 'id'), req.user.id, upiUtrLast4);
    sendSuccess(res, order, 'Payment reported — awaiting verification');
  } catch (error) {
    next(error);
  }
};

export const updateStatus: RequestHandler = async (req, res, next) => {
  try {
    const order = await orderService.updateStatus(
      param(req, 'id'),
      actor(req),
      req.body as UpdateOrderStatusInput,
    );
    sendSuccess(res, order, 'Order status updated');
  } catch (error) {
    next(error);
  }
};

export const assign: RequestHandler = async (req, res, next) => {
  try {
    const order = await orderService.assign(
      param(req, 'id'),
      actor(req),
      req.body as AssignOrderInput,
    );
    sendSuccess(res, order, 'Rider assigned');
  } catch (error) {
    next(error);
  }
};

export const updateTracking: RequestHandler = async (req, res, next) => {
  try {
    const tracking = await orderService.updateTracking(
      param(req, 'id'),
      actor(req),
      req.body as OrderTrackingInput,
    );
    sendSuccess(res, tracking, 'Tracking updated');
  } catch (error) {
    next(error);
  }
};

export const getTracking: RequestHandler = async (req, res, next) => {
  try {
    const tracking = await orderService.getTracking(
      param(req, 'id'),
      actor(req),
    );
    sendSuccess(res, tracking, 'Tracking fetched');
  } catch (error) {
    next(error);
  }
};
