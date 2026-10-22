import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response';
import { storeService } from './store.service';
import type { UpdateStoreInput } from './store.schemas';

export const getStore: RequestHandler = async (_req, res, next) => {
  try {
    const store = await storeService.getStore();
    sendSuccess(res, store, 'Store fetched');
  } catch (error) {
    next(error);
  }
};

export const updateStore: RequestHandler = async (req, res, next) => {
  try {
    const store = await storeService.updateStore(req.body as UpdateStoreInput);
    sendSuccess(res, store, 'Store updated');
  } catch (error) {
    next(error);
  }
};
