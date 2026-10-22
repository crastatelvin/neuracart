import { Platform } from 'react-native';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_ROOT = (
  configuredUrl ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://localhost:8000')
).replace(/\/$/, '');

export const API_BASE = `${API_ROOT}/api`;

export const FREE_DELIVERY_ABOVE = 500;
export const DELIVERY_FEE = 40;
export const SUPPORT_EMAIL = 'support@localmart.app';
export const SUPPORT_PHONE = '+918040001234';
export const MAX_ADDRESSES = 10;

export const STORE_FALLBACK = {
  id: 'fallback',
  name: 'LocalMart Central',
  address: '14, 100 Feet Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
  latitude: 12.9716,
  longitude: 77.5946,
  phone: '+91 80 4000 1234',
  email: SUPPORT_EMAIL,
  openTime: '08:00',
  closeTime: '22:00',
  deliveryFee: DELIVERY_FEE.toFixed(2),
  freeDeliveryAbove: FREE_DELIVERY_ABOVE.toFixed(2),
  isOpen: true,
  manuallyOpen: true,
  timezone: 'Asia/Kolkata',
  updatedAt: new Date().toISOString(),
};
