import type { Store } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { isStoreOpenNow } from '../../utils/store';
import { storeRepository } from './store.repository';
import type { UpdateStoreInput } from './store.schemas';

function serializeStore(store: Store) {
  return {
    id: store.id,
    name: store.name,
    address: store.address,
    city: store.city,
    state: store.state,
    pincode: store.pincode,
    latitude: store.latitude,
    longitude: store.longitude,
    phone: store.phone,
    email: store.email,
    openTime: store.openTime,
    closeTime: store.closeTime,
    deliveryFee: store.deliveryFee.toFixed(2),
    freeDeliveryAbove: store.freeDeliveryAbove.toFixed(2),
    isOpen: isStoreOpenNow(store),
    manuallyOpen: store.isOpen,
    timezone: 'Asia/Kolkata',
    updatedAt: store.updatedAt,
  };
}

export const storeService = {
  async getStore() {
    return serializeStore(await storeRepository.ensure());
  },

  async updateStore(input: UpdateStoreInput) {
    const existing = await storeRepository.ensure();
    const openTime = input.openTime ?? existing.openTime;
    const closeTime = input.closeTime ?? existing.closeTime;
    if (openTime >= closeTime) {
      throw new AppError(
        'Opening time must be before closing time',
        422,
        'INVALID_STORE_HOURS',
      );
    }

    const updated = await storeRepository.update(existing.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.openTime !== undefined ? { openTime: input.openTime } : {}),
      ...(input.closeTime !== undefined ? { closeTime: input.closeTime } : {}),
      ...(input.deliveryFee !== undefined
        ? { deliveryFee: input.deliveryFee }
        : {}),
      ...(input.freeDeliveryAbove !== undefined
        ? { freeDeliveryAbove: input.freeDeliveryAbove }
        : {}),
      ...(input.isOpen !== undefined ? { isOpen: input.isOpen } : {}),
    });
    return serializeStore(updated);
  },
};
