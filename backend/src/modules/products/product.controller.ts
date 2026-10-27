import type { RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { sendPaginated, sendSuccess } from '../../utils/response';
import type {
  ProductCreateInput,
  ProductListQuery,
  ProductUpdateInput,
} from './product.schemas';
import { productService } from './product.service';
import { param } from '../../utils/request';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.validatedQuery as ProductListQuery;
    const canSeeInactive = req.user?.role === Role.ADMIN;
    const result = await productService.list(query, canSeeInactive);
    sendPaginated(res, result.data, result.pagination, 'Products fetched');
  } catch (error) {
    next(error);
  }
};

export const featured: RequestHandler = async (_req, res, next) => {
  try {
    const products = await productService.featured();
    sendSuccess(res, products, 'Featured products fetched');
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const product = await productService.getById(
      param(req, 'id'),
      req.user?.role === Role.ADMIN,
    );
    sendSuccess(res, product, 'Product fetched');
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const product = await productService.create(
      req.body as ProductCreateInput,
      req.file,
    );
    sendSuccess(res, product, 'Product created', 201);
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const product = await productService.update(
      param(req, 'id'),
      req.body as ProductUpdateInput,
      req.file,
    );
    sendSuccess(res, product, 'Product updated');
  } catch (error) {
    next(error);
  }
};

export const toggle: RequestHandler = async (req, res, next) => {
  try {
    const product = await productService.toggle(param(req, 'id'));
    sendSuccess(res, product, 'Product updated');
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const result = await productService.remove(param(req, 'id'));
    sendSuccess(
      res,
      result,
      result.softDeleted
        ? 'Product deactivated because it appears in past orders'
        : 'Product deleted',
    );
  } catch (error) {
    next(error);
  }
};
