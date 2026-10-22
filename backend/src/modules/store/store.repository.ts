import type { Prisma, Store } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';

export const storeRepository = {
  findFirst(): Promise<Store | null> {
    return prisma.store.findFirst();
  },

  async ensure(): Promise<Store> {
    const existing = await prisma.store.findFirst();
    if (existing) return existing;
    return prisma.store.create({
      data: {
        name: 'LocalMart Central',
        address: '14, 100 Feet Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        latitude: 12.9716,
        longitude: 77.5946,
        phone: '+91 80 4000 1234',
        email: env.SUPPORT_EMAIL,
      },
    });
  },

  update(id: string, data: Prisma.StoreUpdateInput): Promise<Store> {
    return prisma.store.update({ where: { id }, data });
  },
};
