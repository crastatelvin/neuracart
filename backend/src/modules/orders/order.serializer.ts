import type { OrderWithRelations } from './order.repository';
import { API_CATEGORY, API_ORDER_STATUS, API_PAYMENT_METHOD, API_PAYMENT_STATUS } from '../../utils/enums';
import { absoluteAssetUrl } from '../../utils/url';
import { env } from '../../config/env';

export const ASSIGNMENT_ACCEPTED_NOTE = 'Rider accepted the assignment';

export function isAssignmentAccepted(order: OrderWithRelations): boolean {
  if (!order.deliveryPartnerId) return false;
  return order.statusHistory.some(
    (entry) =>
      entry.status === 'ASSIGNED' &&
      entry.note === ASSIGNMENT_ACCEPTED_NOTE &&
      entry.changedBy === order.deliveryPartnerId,
  );
}

export function serializeOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: API_ORDER_STATUS[order.status],
    paymentStatus: API_PAYMENT_STATUS[order.paymentStatus],
    paymentMethod: API_PAYMENT_METHOD[order.paymentMethod],
    subtotal: order.subtotal.toFixed(2),
    deliveryFee: order.deliveryFee.toFixed(2),
    discount: order.discount.toFixed(2),
    total: order.total.toFixed(2),
    // ——— v2 surfaces ———
    fulfilment: order.fulfilment === 'PICKUP' ? 'pickup' : 'delivery',
    walletApplied: order.walletApplied.toFixed(2),
    loyaltyPointsEarned: order.loyaltyPointsEarned,
    loyaltyPointsUsed: order.loyaltyPointsUsed,
    green: greenScore(order),
    payout:
      order.deliveryPartnerId && order.status !== 'CANCELLED'
        ? env.RIDER_PAYOUT.toFixed(2)
        : null,
    accepted: isAssignmentAccepted(order),
    notes: order.notes,
    estimatedAt: order.estimatedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer,
    deliveryPartner: order.deliveryPartner,
    address: {
      id: order.address.id,
      label: order.address.label,
      line1: order.address.line1,
      line2: order.address.line2,
      city: order.address.city,
      state: order.address.state,
      pincode: order.address.pincode,
      latitude: order.address.latitude,
      longitude: order.address.longitude,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
      product: {
        id: item.product.id,
        name: item.product.name,
        imageUrl: absoluteAssetUrl(item.product.imageUrl),
        unit: item.product.unit,
        category: API_CATEGORY[item.product.category],
        isActive: item.product.isActive,
      },
    })),
    itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
    statusHistory: order.statusHistory.map((entry) => ({
      id: entry.id,
      status: API_ORDER_STATUS[entry.status],
      note: entry.note,
      changedBy: entry.changedBy,
      createdAt: entry.createdAt,
    })),
    tracking: order.tracking
      ? {
          latitude: order.tracking.latitude,
          longitude: order.tracking.longitude,
          storeLatitude: order.tracking.storeLatitude,
          storeLongitude: order.tracking.storeLongitude,
          customerLatitude: order.tracking.customerLatitude,
          customerLongitude: order.tracking.customerLongitude,
          updatedAt: order.tracking.updatedAt,
        }
      : null,
  };
}

/** Simple model estimate: consolidated one-trip delivery vs. individual errands. */
function greenScore(order: OrderWithRelations): {
  distanceKm: number;
  co2SavedKg: number;
  bagsReused: number;
} | null {
  if (!order.address.latitude || !order.address.longitude) return null;
  const km = haversineKm(
    order.tracking?.storeLatitude ?? 12.9716,
    order.tracking?.storeLongitude ?? 77.5946,
    order.address.latitude,
    order.address.longitude,
  );
  // Consolidated e-bike delivery ≈ 0.075 kg/km vs. individual car errands ≈ 0.23 kg/km.
  const co2SavedKg = Math.max(0, km * (0.23 - 0.075));
  return {
    distanceKm: Number(km.toFixed(2)),
    co2SavedKg: Number(co2SavedKg.toFixed(2)),
    bagsReused: 1,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
