import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { ApiError, apiErrorMessage, apiRequest } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import type {
  Assignments,
  DeliveryProfile,
  Earnings,
  EarningsPeriod,
  Order,
  User,
} from '@/lib/types';
import { appStorage, secureStorage, storageKeys } from '@/lib/storage';
import {
  clearSessionTokens,
  getAccessToken,
  hydrateSessionTokens,
  setSessionTokens,
} from '@/lib/session';

export type SessionStatus = 'booting' | 'signedIn' | 'signedOut';

type LoginPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
  deliveryProfile: {
    vehicleType: string;
    vehicleNumber: string;
    isAvailable: boolean;
    isVerified: boolean;
    totalDeliveries: number;
    earnings: string;
  };
};

type AssignmentGroup = keyof Omit<Assignments, 'counts'>;

export type DeliveryState = {
  status: SessionStatus;
  bootError: string | null;
  profile: DeliveryProfile | null;
  assignments: Assignments | null;
  error: string | null;
  busy: string | null;
  earnings: Earnings | null;
  earningPeriod: EarningsPeriod;
  earningsError: string | null;

  loadStoredSession(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  fetchAssignments(): Promise<void>;
  fetchEarnings(period: EarningsPeriod): Promise<void>;
  accept(orderId: string): Promise<void>;
  reject(orderId: string): Promise<void>;
  start(orderId: string): Promise<void>;
  complete(orderId: string): Promise<void>;
  setAvailability(isAvailable: boolean): Promise<void>;
  sessionExpired(): void;
  findAssignment(orderId: string): Order | null;
};

function isDeliveryProfile(value: DeliveryProfile | null): value is DeliveryProfile {
  return !!value && typeof value.email === 'string' && 'isAvailable' in value;
}

async function persistProfile(profile: DeliveryProfile | null): Promise<void> {
  if (profile) {
    await appStorage.setJson(storageKeys.profile, profile);
  } else {
    await appStorage.remove(storageKeys.profile);
  }
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  status: 'booting',
  bootError: null,
  profile: null,
  assignments: null,
  error: null,
  busy: null,
  earnings: null,
  earningPeriod: 'today',
  earningsError: null,

  async loadStoredSession() {
    try {
      await hydrateSessionTokens();
      const storedProfile = await appStorage.getJson<DeliveryProfile>(storageKeys.profile);
      if (!getAccessToken() || !isDeliveryProfile(storedProfile)) {
        await clearSessionTokens();
        await persistProfile(null);
        set({ status: 'signedOut', bootError: null });
        return;
      }
      // Verify the cached profile is still valid, but keep it if offline.
      try {
        const profile = await apiRequest<DeliveryProfile>('/delivery/profile');
        await persistProfile(profile);
        set({ status: 'signedIn', profile, bootError: null });
      } catch {
        set({ status: 'signedIn', profile: storedProfile, bootError: null });
      }
    } catch {
      set({ status: 'signedOut', bootError: null });
    }
  },

  async signIn(email, password) {
    const payload = await apiRequest<LoginPayload>('/auth/delivery/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
      auth: false,
    });
    await setSessionTokens({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
    const profile: DeliveryProfile = {
      id: 'unknown',
      userId: payload.user.id,
      name: payload.user.name,
      email: payload.user.email,
      phone: payload.user.phone,
      vehicleType: payload.deliveryProfile.vehicleType,
      vehicleNumber: payload.deliveryProfile.vehicleNumber,
      isAvailable: payload.deliveryProfile.isAvailable,
      isVerified: payload.deliveryProfile.isVerified,
      totalDeliveries: payload.deliveryProfile.totalDeliveries,
      earnings: payload.deliveryProfile.earnings,
      rating: null,
      memberSince: new Date().toISOString(),
    };
    await persistProfile(profile);
    set({ status: 'signedIn', profile, error: null });
  },

  async signOut() {
    const refreshToken = await secureStorage.get(storageKeys.refreshToken);
    await clearSessionTokens();
    await persistProfile(null);
    try {
      if (refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Signing out locally always succeeds even if the server call fails.
    }
    set({
      status: 'signedOut',
      profile: null,
      assignments: null,
      earnings: null,
      error: null,
      busy: null,
    });
  },

  async refreshProfile() {
    const profile = await apiRequest<DeliveryProfile>('/delivery/profile');
    await persistProfile(profile);
    set({ profile });
  },

  async fetchAssignments() {
    try {
      const assignments = await apiRequest<Assignments>(
        '/delivery/assignments?status=all',
      );
      set({ assignments, error: null });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      set({ error: apiErrorMessage(error) });
    }
  },

  async fetchEarnings(period: EarningsPeriod) {
    set({ earningPeriod: period, earningsError: null });
    try {
      const earnings = await apiRequest<Earnings>(
        `/delivery/earnings?period=${period}`,
      );
      set({ earnings });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      set({ earningsError: apiErrorMessage(error) });
    }
  },

  async accept(orderId) {
    const key = `accept:${orderId}`;
    set({ busy: key });
    try {
      const order = await apiRequest<Order>(
        `/delivery/assignments/${orderId}/accept`,
        { method: 'PATCH' },
      );
      moveGroup(set, get, 'new', 'ready', order);
    } catch (error) {
      if (error instanceof ApiError) rethrow(error);
    } finally {
      if (get().busy === key) set({ busy: null });
    }
  },

  async reject(orderId) {
    const key = `reject:${orderId}`;
    set({ busy: key });
    try {
      await apiRequest(`/delivery/assignments/${orderId}/reject`, {
        method: 'PATCH',
      });
      await get().fetchAssignments();
    } catch (error) {
      if (error instanceof ApiError) rethrow(error);
    } finally {
      if (get().busy === key) set({ busy: null });
    }
  },

  async start(orderId) {
    const key = `start:${orderId}`;
    set({ busy: key });
    try {
      const order = await apiRequest<Order>(
        `/delivery/assignments/${orderId}/start`,
        { method: 'PATCH' },
      );
      moveGroup(set, get, 'ready', 'active', order);
    } catch (error) {
      if (error instanceof ApiError) rethrow(error);
    } finally {
      if (get().busy === key) set({ busy: null });
    }
  },

  async complete(orderId) {
    const key = `complete:${orderId}`;
    set({ busy: key });
    try {
      const order = await apiRequest<Order>(
        `/delivery/assignments/${orderId}/complete`,
        {
          method: 'PATCH',
          body: {},
          idempotencyKey: Crypto.randomUUID(),
        },
      );
      moveGroup(set, get, 'active', 'completed', order);
      void get().refreshProfile().catch(() => undefined);
    } catch (error) {
      if (error instanceof ApiError) rethrow(error);
    } finally {
      if (get().busy === key) set({ busy: null });
    }
  },

  async setAvailability(isAvailable) {
    const previous = get().profile;
    set({ profile: previous ? { ...previous, isAvailable } : null });
    try {
      const profile = await apiRequest<DeliveryProfile>('/delivery/availability', {
        method: 'PATCH',
        body: { isAvailable },
      });
      await persistProfile(profile);
      set({ profile });
    } catch (error) {
      set({ profile: previous });
      throw error;
    }
  },

  sessionExpired() {
    void clearSessionTokens();
    void persistProfile(null);
    set({
      status: 'signedOut',
      profile: null,
      assignments: null,
      earnings: null,
      error: null,
      busy: null,
    });
  },

  findAssignment(orderId) {
    const assignments = get().assignments;
    if (!assignments) return null;
    return (
      assignments.new.find((order) => order.id === orderId) ??
      assignments.ready.find((order) => order.id === orderId) ??
      assignments.active.find((order) => order.id === orderId) ??
      assignments.completed.find((order) => order.id === orderId) ??
      null
    );
  },
}));

/** Surface an action error as a typed ApiError so screens can toast it. */
function rethrow(error: ApiError): never {
  throw error;
}

/** Move an order card between assignment groups after a mutation. */
function moveGroup(
  set: (partial: Partial<DeliveryState>) => void,
  get: () => DeliveryState,
  from: AssignmentGroup,
  to: AssignmentGroup,
  order: Order,
): void {
  const assignments = get().assignments;
  if (!assignments) {
    void get().fetchAssignments();
    return;
  }
  const counts = { ...assignments.counts };
  const moved = assignments[from].filter((entry) => entry.id !== order.id);
  const target = to === from
    ? assignments[to].map((entry) => (entry.id === order.id ? order : entry))
    : [...assignments[to], order];

  if (from !== to) {
    counts[from] = Math.max(0, counts[from] - 1);
    if (from !== 'completed') counts.current = Math.max(0, counts.current - 1);
    if (to === 'completed') counts.completed = counts.completed + 1;
    else counts.current = counts.current + 1;
  }

  set({
    assignments: {
      ...assignments,
      [from]: moved,
      [to]: target,
      counts,
    },
  });
}
