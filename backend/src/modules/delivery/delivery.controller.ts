import type { Request, RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response';
import { param } from '../../utils/request';
import { deliveryService } from './delivery.service';
import type {
  AssignmentQuery,
  AvailabilityInput,
  CompleteAssignmentInput,
  EarningsQuery,
} from './delivery.schemas';

function actor(req: Request) {
  if (!req.user) throw new Error('authenticate middleware did not attach a user');
  return req.user;
}

export const listAssignments: RequestHandler = async (req, res, next) => {
  try {
    const assignments = await deliveryService.getAssignments(
      actor(req).id,
      req.validatedQuery as AssignmentQuery,
    );
    sendSuccess(res, assignments, 'Assignments fetched');
  } catch (error) {
    next(error);
  }
};

export const acceptAssignment: RequestHandler = async (req, res, next) => {
  try {
    const order = await deliveryService.accept(param(req, 'id'), actor(req).id);
    sendSuccess(res, order, 'Assignment accepted');
  } catch (error) {
    next(error);
  }
};

export const rejectAssignment: RequestHandler = async (req, res, next) => {
  try {
    const order = await deliveryService.reject(param(req, 'id'), actor(req).id);
    sendSuccess(res, order, 'Assignment declined');
  } catch (error) {
    next(error);
  }
};

export const startAssignment: RequestHandler = async (req, res, next) => {
  try {
    const order = await deliveryService.start(param(req, 'id'), actor(req).id);
    sendSuccess(res, order, 'Delivery started');
  } catch (error) {
    next(error);
  }
};

export const completeAssignment: RequestHandler = async (req, res, next) => {
  try {
    const order = await deliveryService.complete(
      param(req, 'id'),
      actor(req).id,
      req.body as CompleteAssignmentInput,
    );
    sendSuccess(res, order, 'Delivery completed');
  } catch (error) {
    next(error);
  }
};

export const getEarnings: RequestHandler = async (req, res, next) => {
  try {
    const earnings = await deliveryService.earnings(
      actor(req).id,
      req.validatedQuery as EarningsQuery,
    );
    sendSuccess(res, earnings, 'Earnings fetched');
  } catch (error) {
    next(error);
  }
};

export const getProfile: RequestHandler = async (req, res, next) => {
  try {
    const profile = await deliveryService.getProfile(actor(req).id);
    sendSuccess(res, profile, 'Rider profile fetched');
  } catch (error) {
    next(error);
  }
};

export const updateAvailability: RequestHandler = async (req, res, next) => {
  try {
    const profile = await deliveryService.updateAvailability(
      actor(req).id,
      req.body as AvailabilityInput,
    );
    sendSuccess(res, profile, 'Availability updated');
  } catch (error) {
    next(error);
  }
};
