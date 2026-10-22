import type { Address, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

type DbClient = Prisma.TransactionClient;

export const addressRepository = {
  listByUser(userId: string): Promise<Address[]> {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findByIdAndUser(id: string, userId: string): Promise<Address | null> {
    return prisma.address.findFirst({ where: { id, userId } });
  },

  countByUser(userId: string): Promise<number> {
    return prisma.address.count({ where: { userId } });
  },

  clearDefaults(userId: string, db: DbClient = prisma): Promise<Prisma.BatchPayload> {
    return db.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  },

  create(
    data: Prisma.AddressUncheckedCreateInput,
    db: DbClient = prisma,
  ): Promise<Address> {
    return db.address.create({ data });
  },

  update(
    id: string,
    data: Prisma.AddressUpdateInput,
    db: DbClient = prisma,
  ): Promise<Address> {
    return db.address.update({ where: { id }, data });
  },

  delete(id: string, db: DbClient = prisma): Promise<Address> {
    return db.address.delete({ where: { id } });
  },

  findNewestOther(
    userId: string,
    excludeId: string,
    db: DbClient = prisma,
  ): Promise<Address | null> {
    return db.address.findFirst({
      where: { userId, id: { not: excludeId } },
      orderBy: { createdAt: 'desc' },
    });
  },
};
