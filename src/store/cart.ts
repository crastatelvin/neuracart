import { create } from 'zustand';
import { DELIVERY_FEE, FREE_DELIVERY_ABOVE } from '@/lib/config';
import { appStorage, storageKeys } from '@/lib/storage';
import type { CartItem, Product, StoreInfo } from '@/lib/types';

type CartState = {
  userId: string | null;
  items: CartItem[];
  hydrated: boolean;
  hydrate: (userId: string) => Promise<void>;
  addItem: (product: Product) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  reset: () => void;
};

function cartKey(userId: string): string {
  return `${storageKeys.cartPrefix}${userId}`;
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.quantity === 'number' &&
    item.quantity > 0 &&
    !!item.product &&
    typeof item.product.id === 'string' &&
    typeof item.product.price === 'string' &&
    typeof item.product.stock === 'number'
  );
}

export const useCartStore = create<CartState>((set, get) => {
  const persist = (items: CartItem[], userId: string | null) => {
    if (!userId) return;
    void appStorage.setJson(cartKey(userId), items);
  };

  const commit = (items: CartItem[]) => {
    set({ items });
    persist(items, get().userId);
  };

  const changeQuantity = (productId: string, delta: number) => {
    const items = get().items;
    const existing = items.find((item) => item.product.id === productId);
    if (!existing) return;
    const nextQuantity = existing.quantity + delta;
    if (nextQuantity <= 0) {
      commit(items.filter((item) => item.product.id !== productId));
      return;
    }
    if (nextQuantity > existing.product.stock) return;
    commit(
      items.map((item) =>
        item.product.id === productId ? { ...item, quantity: nextQuantity } : item,
      ),
    );
  };

  return {
    userId: null,
    items: [],
    hydrated: false,

    hydrate: async (userId) => {
      if (get().userId === userId && get().hydrated) return;
      const stored = await appStorage.getJson<unknown>(cartKey(userId));
      const items = Array.isArray(stored) ? stored.filter(isCartItem) : [];
      set({ userId, items, hydrated: true });
    },

    addItem: (product) => {
      if (product.stock <= 0) return;
      const items = get().items;
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return;
        commit(
          items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1, product }
              : item,
          ),
        );
        return;
      }
      commit([...items, { product, quantity: 1 }]);
    },

    increment: (productId) => changeQuantity(productId, 1),
    decrement: (productId) => changeQuantity(productId, -1),
    removeItem: (productId) =>
      commit(get().items.filter((item) => item.product.id !== productId)),

    clear: () => {
      commit([]);
    },

    reset: () => {
      const userId = get().userId;
      if (userId) void appStorage.remove(cartKey(userId));
      set({ userId: null, items: [], hydrated: false });
    },
  };
});

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce(
    (total, item) => total + Number(item.product.price) * item.quantity,
    0,
  );
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

export function cartDeliveryFee(
  subtotal: number,
  store?: Pick<StoreInfo, 'deliveryFee' | 'freeDeliveryAbove'> | null,
): number {
  const threshold = Number(store?.freeDeliveryAbove ?? FREE_DELIVERY_ABOVE);
  if (subtotal >= threshold) return 0;
  return Number(store?.deliveryFee ?? DELIVERY_FEE);
}

export function cartTotal(
  subtotal: number,
  store?: Pick<StoreInfo, 'deliveryFee' | 'freeDeliveryAbove'> | null,
): number {
  return subtotal + cartDeliveryFee(subtotal, store);
}

export function freeDeliveryRemaining(
  subtotal: number,
  store?: Pick<StoreInfo, 'deliveryFee' | 'freeDeliveryAbove'> | null,
): number {
  return Math.max(0, Number(store?.freeDeliveryAbove ?? FREE_DELIVERY_ABOVE) - subtotal);
}
