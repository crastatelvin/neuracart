import { Platform } from 'react-native';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_ROOT = (
  configuredUrl ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://localhost:8000')
).replace(/\/$/, '');

export const API_BASE = `${API_ROOT}/api`;

/** Rider payout is fixed by the store plan (see plan.md §9/§15). */
export const RIDER_PAYOUT = 40;
export const MAX_ACTIVE_ASSIGNMENTS = 3;
export const SUPPORT_PHONE = '+918040001234';
export const SUPPORT_EMAIL = 'support@localmart.app';

export const STORE_PREVIEW = {
  name: 'LocalMart Central',
  address: '14, 100 Feet Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
  latitude: 12.9716,
  longitude: 77.5946,
  phone: '+91 80 4000 1234',
} as const;

export const DEMO_CREDENTIALS = {
  email: 'driver1@localmart.app',
  password: 'LocalMart@123',
} as const;
