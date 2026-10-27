import { Prisma, type Product } from '@prisma/client';
import { env } from '../../config/env';
import {
  deleteProductImage,
  saveProductImage,
} from '../../services/upload.service';
import { API_CATEGORY } from '../../utils/enums';
import { AppError } from '../../utils/errors';
import { getPaginationMeta, getPaginationParams } from '../../utils/response';
import { productRepository as repo } from './product.repository';
import type {
  ProductCreateInput,
  ProductListQuery,
  ProductUpdateInput,
} from './product.schemas';

export type ProductDto = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: string;
  unit: string;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function imageUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  return `${env.PUBLIC_API_URL.replace(/\/$/, '')}${value}`;
}

export function serializeProduct(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: API_CATEGORY[product.category],
    price: product.price.toFixed(2),
    unit: product.unit,
    stock: product.stock,
    imageUrl: imageUrl(product.imageUrl),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export const productService = {
  async list(query: ProductListQuery, includeInactive = false) {
    const pagination = getPaginationParams(query.page, query.limit, 20, 50);
    const status = includeInactive ? (query.status ?? 'all') : 'active';
    const where: Prisma.ProductWhereInput = {
      ...(status === 'active'
        ? { isActive: true }
        : status === 'inactive'
          ? { isActive: false }
          : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.featured === undefined ? {} : { isFeatured: query.featured }),
      ...(query.lowStock ? { stock: { lte: 5 } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [products, total] = await repo.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy,
    });

    return {
      data: products.map(serializeProduct),
      pagination: getPaginationMeta(
        pagination.page,
        pagination.limit,
        total,
      ),
    };
  },

  async featured(): Promise<ProductDto[]> {
    const products = await repo.findFeatured();
    return products.map(serializeProduct);
  },

  async getById(id: string, includeInactive = false): Promise<ProductDto> {
    const product = await repo.findById(id);
    if (!product || (!includeInactive && !product.isActive)) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    return serializeProduct(product);
  },

  async create(
    input: ProductCreateInput,
    file?: Express.Multer.File,
  ): Promise<ProductDto> {
    const newImage = file ? await saveProductImage(file) : null;
    try {
      const product = await repo.create({
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        price: new Prisma.Decimal(input.price),
        unit: input.unit,
        stock: input.stock,
        imageUrl: newImage,
        isActive: input.isActive ?? true,
        isFeatured: input.isFeatured ?? false,
      });
      return serializeProduct(product);
    } catch (error) {
      if (newImage) await deleteProductImage(newImage);
      throw error;
    }
  },

  async update(
    id: string,
    input: ProductUpdateInput,
    file?: Express.Multer.File,
  ): Promise<ProductDto> {
    const existing = await repo.findById(id);
    if (!existing) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    if (Object.keys(input).length === 0 && !file) {
      throw new AppError('No fields to update', 400, 'NO_CHANGES');
    }

    const newImage = file ? await saveProductImage(file) : null;
    try {
      const product = await repo.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.price !== undefined
          ? { price: new Prisma.Decimal(input.price) }
          : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isFeatured !== undefined
          ? { isFeatured: input.isFeatured }
          : {}),
        ...(newImage ? { imageUrl: newImage } : {}),
      });

      if (newImage && existing.imageUrl) {
        await deleteProductImage(existing.imageUrl);
      }
      return serializeProduct(product);
    } catch (error) {
      if (newImage) await deleteProductImage(newImage);
      throw error;
    }
  },

  async toggle(id: string): Promise<ProductDto> {
    const existing = await repo.findById(id);
    if (!existing) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    const product = await repo.update(id, { isActive: !existing.isActive });
    return serializeProduct(product);
  },

  async remove(
    id: string,
  ): Promise<{ softDeleted: boolean; product?: ProductDto }> {
    const existing = await repo.findById(id);
    if (!existing) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const references = await repo.countOrderItems(id);
    if (references > 0) {
      const product = await repo.update(id, { isActive: false });
      return { softDeleted: true, product: serializeProduct(product) };
    }

    await repo.delete(id);
    await deleteProductImage(existing.imageUrl);
    return { softDeleted: false };
  },
};
