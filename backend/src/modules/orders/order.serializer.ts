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
