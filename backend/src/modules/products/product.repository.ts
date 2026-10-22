import type { Prisma, Product } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const productRepository = {
  async findMany(input: {
    where: Prisma.ProductWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.ProductOrderByWithRelationInput;
  }): Promise<[Product[], number]> {
    return prisma.$transaction([
      prisma.product.findMany({
        where: input.where,
        skip: input.skip,
        take: input.take,
        orderBy: input.orderBy,
      }),
      prisma.product.count({ where: input.where }),
    ]);
  },

  findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({ where: { id } });
  },

  findFeatured(): Promise<Product[]> {
    return prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
  },

  create(data: Prisma.ProductCreateInput): Promise<Product> {
    return prisma.product.create({ data });
  },

  update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return prisma.product.update({ where: { id }, data });
  },

  delete(id: string): Promise<Product> {
    return prisma.product.delete({ where: { id } });
  },

  countOrderItems(productId: string): Promise<number> {
    return prisma.orderItem.count({ where: { productId } });
  },
};
