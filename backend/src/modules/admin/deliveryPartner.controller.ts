import type { RequestHandler } from 'express';
import { sendPaginated, sendSuccess } from '../../utils/response';
import { param } from '../../utils/request';
import { deliveryPartnerAdminService } from './deliveryPartner.service';
import type {
  CreatePartnerInput,
  ListPartnersQuery,
  UpdatePartnerInput,
  VerifyPartnerInput,
} from './deliveryPartner.schemas';

export const listPartners: RequestHandler = async (req, res, next) => {
  try {
    const result = await deliveryPartnerAdminService.list(
      req.validatedQuery as ListPartnersQuery,
    );
    sendPaginated(
      res,
      result.data,
      result.pagination,
      'Delivery partners fetched',
    );
  } catch (error) {
    next(error);
  }
};

export const createPartner: RequestHandler = async (req, res, next) => {
  try {
    const partner = await deliveryPartnerAdminService.create(
      req.body as CreatePartnerInput,
    );
    sendSuccess(res, partner, 'Delivery partner created', 201);
  } catch (error) {
    next(error);
  }
};

export const updatePartner: RequestHandler = async (req, res, next) => {
  try {
    const partner = await deliveryPartnerAdminService.update(
      param(req, 'id'),
      req.body as UpdatePartnerInput,
    );
    sendSuccess(res, partner, 'Delivery partner updated');
  } catch (error) {
    next(error);
  }
};

export const verifyPartner: RequestHandler = async (req, res, next) => {
  try {
    const partner = await deliveryPartnerAdminService.verify(
      param(req, 'id'),
      req.body as VerifyPartnerInput,
    );
    sendSuccess(res, partner, 'Delivery partner verification updated');
  } catch (error) {
    next(error);
  }
};

export const deactivatePartner: RequestHandler = async (req, res, next) => {
  try {
    const partner = await deliveryPartnerAdminService.deactivate(
      param(req, 'id'),
    );
    sendSuccess(res, partner, 'Delivery partner deactivated');
  } catch (error) {
    next(error);
  }
};
