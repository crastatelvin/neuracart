import type { Request, RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response';
import type {
  AddressCreateInput,
  AddressUpdateInput,
} from './address.schemas';
import { addressService } from './address.service';
import { param } from '../../utils/request';

function userId(req: Request): string {
  if (!req.user) throw new Error('authenticate middleware did not attach a user');
  return req.user.id;
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const addresses = await addressService.list(userId(req));
    sendSuccess(res, addresses, 'Addresses fetched');
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const address = await addressService.getById(param(req, 'id'), userId(req));
    sendSuccess(res, address, 'Address fetched');
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const address = await addressService.create(
      userId(req),
      req.body as AddressCreateInput,
    );
    sendSuccess(res, address, 'Address created', 201);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const address = await addressService.update(
      param(req, 'id'),
      userId(req),
      req.body as AddressUpdateInput,
    );
    sendSuccess(res, address, 'Address updated');
  } catch (error) {
    next(error);
  }
};

export const setDefault: RequestHandler = async (req, res, next) => {
  try {
    const address = await addressService.setDefault(
      param(req, 'id'),
      userId(req),
    );
    sendSuccess(res, address, 'Default address updated');
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await addressService.remove(param(req, 'id'), userId(req));
    sendSuccess(res, null, 'Address deleted');
  } catch (error) {
    next(error);
  }
};
