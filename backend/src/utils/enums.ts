import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCategory,
  Role,
} from '@prisma/client';

export const API_ROLE: Record<Role, string> = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  DELIVERY_PARTNER: 'delivery_partner',
};

export const API_CATEGORY: Record<ProductCategory, string> = {
  FRUITS: 'fruits',
  VEGETABLES: 'vegetables',
  MEAT: 'meat',
};

export const API_ORDER_STATUS: Record<OrderStatus, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  ASSIGNED: 'assigned',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const API_PAYMENT_METHOD: Record<PaymentMethod, string> = {
  COD: 'cod',
  ONLINE: 'online',
};

export const API_PAYMENT_STATUS: Record<PaymentStatus, string> = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};
