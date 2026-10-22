import { create } from 'zustand';
import { apiRequest } from '@/lib/api';
import { STORE_FALLBACK } from '@/lib/config';
import type { StoreInfo } from '@/lib/types';

type ConfigState = {
  store: StoreInfo;
  loaded: boolean;
  loading: boolean;
  loadStore: () => Promise<void>;
};

export const useConfigStore = create<ConfigState>((set) => ({
  store: STORE_FALLBACK,
  loaded: false,
  loading: false,
  loadStore: async () => {
    set({ loading: true });
    try {
      const store = await apiRequest<StoreInfo>('/store', { auth: false });
      set({ store, loaded: true, loading: false });
    } catch {
      set({ loaded: true, loading: false });
    }
  },
}));
