import type { Address } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { addressRepository as repo } from './address.repository';
import type {
  AddressCreateInput,
  AddressUpdateInput,
} from './address.schemas';

export type AddressDto = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeAddress(address: Address): AddressDto {
  return {
    id: address.id,
    label: address.label,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    latitude: address.latitude,
    longitude: address.longitude,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

async function getOwned(id: string, userId: string): Promise<Address> {
  const address = await repo.findByIdAndUser(id, userId);
  if (!address) {
    throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
  }
  return address;
}

export const addressService = {
  async list(userId: string): Promise<AddressDto[]> {
    const addresses = await repo.listByUser(userId);
    return addresses.map(serializeAddress);
  },

  async getById(id: string, userId: string): Promise<AddressDto> {
    return serializeAddress(await getOwned(id, userId));
  },

  async create(
    userId: string,
    input: AddressCreateInput,
  ): Promise<AddressDto> {
    const count = await repo.countByUser(userId);
    if (count >= 10) {
      throw new AppError(
        'You can save up to 10 addresses',
        400,
        'ADDRESS_LIMIT_REACHED',
      );
    }

    const makeDefault = count === 0 || input.isDefault === true;
    const address = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await repo.clearDefaults(userId, tx);
      }
      return repo.create(
        {
          userId,
          label: input.label,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          isDefault: makeDefault,
        },
        tx,
      );
    });
    return serializeAddress(address);
  },

  async update(
    id: string,
    userId: string,
    input: AddressUpdateInput,
  ): Promise<AddressDto> {
    const existing = await getOwned(id, userId);
    if (Object.keys(input).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_CHANGES');
    }

    const address = await prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await repo.clearDefaults(userId, tx);
      }
      if (input.isDefault === false && existing.isDefault) {
        const replacement = await repo.findNewestOther(userId, id, tx);
        if (!replacement) {
          throw new AppError(
            'At least one address must be the default',
            400,
            'DEFAULT_ADDRESS_REQUIRED',
          );
        }
        await repo.update(id, { isDefault: false }, tx);
        await repo.update(replacement.id, { isDefault: true }, tx);
      }
      return repo.update(
        id,
        {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
          ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
          ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
          ...(input.longitude !== undefined
            ? { longitude: input.longitude }
            : {}),
          ...(input.isDefault !== undefined
            ? { isDefault: input.isDefault }
            : {}),
        },
        tx,
      );
    });
    return serializeAddress(address);
  },

  async setDefault(id: string, userId: string): Promise<AddressDto> {
    await getOwned(id, userId);
    const address = await prisma.$transaction(async (tx) => {
      await repo.clearDefaults(userId, tx);
      return repo.update(id, { isDefault: true }, tx);
    });
    return serializeAddress(address);
  },

  async remove(id: string, userId: string): Promise<void> {
    const existing = await getOwned(id, userId);
    await prisma.$transaction(async (tx) => {
      if (existing.isDefault) {
        const replacement = await repo.findNewestOther(userId, id, tx);
        await repo.update(id, { isDefault: false }, tx);
        if (replacement) {
          await repo.update(replacement.id, { isDefault: true }, tx);
        }
      }
      await repo.delete(id, tx);
    });
  },
};
