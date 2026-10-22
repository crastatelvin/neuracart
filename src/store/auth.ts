import { create } from 'zustand';
import { apiErrorMessage, apiRequest, isApiError } from '@/lib/api';
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  hydrateSessionTokens,
  refreshSessionTokens,
  setSessionTokens,
} from '@/lib/session';
import { appStorage, storageKeys } from '@/lib/storage';
import type { MeResponse, User } from '@/lib/types';
import { useCartStore } from './cart';

type VerifyResult = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bootError: string | null;
  loadStoredAuth: () => Promise<void>;
  sendOtp: (email: string) => Promise<{ devOtp?: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
};

async function persistUser(user: User | null): Promise<void> {
  if (user) {
    await appStorage.setJson(storageKeys.user, user);
  } else {
    await appStorage.remove(storageKeys.user);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  bootError: null,

  loadStoredAuth: async () => {
    set({ isLoading: true, bootError: null });
    try {
      await hydrateSessionTokens();
      const cachedUser = await appStorage.getJson<MeResponse>(storageKeys.user);
      const token = getAccessToken();
      if (!token && !getRefreshToken()) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      try {
        const me = await apiRequest<MeResponse>('/auth/me');
        const user: User = {
          id: me.id,
          email: me.email,
          name: me.name,
          phone: me.phone,
          role: me.role,
        };
        await persistUser(user);
        set({ user, isAuthenticated: true, isLoading: false, bootError: null });
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          await get().clearLocalSession();
          return;
        }
        if (cachedUser) {
          const user: User = {
            id: cachedUser.id,
            email: cachedUser.email,
            name: cachedUser.name,
            phone: cachedUser.phone,
            role: cachedUser.role,
          };
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            bootError: apiErrorMessage(error),
          });
          return;
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          bootError: apiErrorMessage(error),
        });
      }
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        bootError: apiErrorMessage(error),
      });
    }
  },

  sendOtp: async (email) => {
    return apiRequest<{ devOtp?: string }>('/auth/send-otp', {
      method: 'POST',
      auth: false,
      body: { email },
    });
  },

  verifyOtp: async (email, code) => {
    const result = await apiRequest<VerifyResult>('/auth/verify-otp', {
      method: 'POST',
      auth: false,
      body: { email, code },
    });
    await setSessionTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await persistUser(result.user);
    set({
      user: result.user,
      isAuthenticated: true,
      isLoading: false,
      bootError: null,
    });
  },

  refreshSession: async () => {
    const refreshed = await refreshSessionTokens();
    if (!refreshed) {
      await get().clearLocalSession();
      return false;
    }
    try {
      const me = await apiRequest<MeResponse>('/auth/me');
      const user: User = {
        id: me.id,
        email: me.email,
        name: me.name,
        phone: me.phone,
        role: me.role,
      };
      await persistUser(user);
      set({ user, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  },

  updateProfile: async (data) => {
    const updated = await apiRequest<User>('/auth/profile', {
      method: 'PATCH',
      body: data,
    });
    await persistUser(updated);
    set({ user: updated });
  },

  signOut: async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          auth: false,
          body: { refreshToken },
        });
      } catch {
        // Signing out locally is still safe when the network is unavailable.
      }
    }
    useCartStore.getState().reset();
    await get().clearLocalSession();
  },

  clearLocalSession: async () => {
    await clearSessionTokens();
    await appStorage.remove(storageKeys.user);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      bootError: null,
    });
  },
}));
