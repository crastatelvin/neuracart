import { Prisma } from '@prisma/client';
import {
  Fulfilment,
  OrderStatus,
  PaymentMethod,
  Role,
  WalletTxnType,
} from '@prisma/client';
import { env } from '../../config/env';
import { moneyService } from '../money/money.service';
import {
  earnLoyaltyOnDelivery,
  refundOrderResources,
} from '../money/money.service';
import { buildUpiIntent, makeUpiAck } from '../money/upi';
import { sendPushToUser } from '../../services/push.service';
import { sendWhatsAppMessage } from '../../services/whatsapp.service';
import { prisma } from '../../config/prisma';
import {
  sendOrderStatusEmail,
  sendRiderAssignmentEmail,
} from '../../services/email.service';
import type { AuthUser } from '../../types/auth';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { nextOrderNumber } from '../../utils/orderNumber';
import { getPaginationMeta, getPaginationParams } from '../../utils/response';
import { assertServiceablePincode, isStoreOpenNow } from '../../utils/store';
import {
  orderInclude,
  orderRepository as repo,
  type OrderWithRelations,
} from './order.repository';
import type {
  AdminOrderListQuery,
  AssignOrderInput,
  CreateOrderInput,
  CustomerOrderListQuery,
  OrderTrackingInput,
  UpdateOrderStatusInput,
} from './order.schemas';
import { serializeOrder } from './order.serializer';
import { publish } from '../../utils/events';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function notifyOrder(order: OrderWithRelations, status: OrderStatus): void {
  const label = status.toLowerCase().replaceAll('_', ' ');
  void sendPushToUser(
    order.customerId,
    `Order ${order.orderNumber}`,
    `Your order is now ${label}.`,
    { orderId: order.id, status },
  );
  if (order.customer.phone) {
    void sendWhatsAppMessage(
      order.customer.phone,
      `NeuraCart ${order.orderNumber}: your order is now ${label}.`,
    );
  }
  publish(`user:${order.customerId}`, 'order.status', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status,
    paymentStatus: order.paymentStatus,
  });
  if (order.deliveryPartnerId) {
    void sendPushToUser(
      order.deliveryPartnerId,
      `Order ${order.orderNumber}`,
      `Status: ${label}.`,
      { orderId: order.id, status },
    );
    publish(`rider:${order.deliveryPartnerId}`, 'order.status', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status,
    });
  }
  publish('admin', 'order.status', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status,
  });
  void sendOrderStatusEmail({
    to: order.customer.email,
    orderNumber: order.orderNumber,
    status,
    total: order.total.toFixed(2),
  }).catch((error: unknown) => {
    logger.error('Could not send order status email', {
      orderId: order.id,
      status,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });
}

/** Attach the `upi://pay` intent when an ONLINE order is still awaiting payment. */
function addUpiIntent(input: OrderWithRelations) {
  const serialized = serializeOrder(input);
  if (input.paymentMethod === PaymentMethod.ONLINE && input.paymentStatus === 'PENDING') {
    return {
      ...serialized,
      upiIntent: buildUpiIntent({
        orderNumber: input.orderNumber,
        amount: input.total.toFixed(2),
      }),
    };
  }
  return serialized;
}

function mergeItems(
  items: CreateOrderInput['items'],
): { productId: string; quantity: number }[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  const result = [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
  if (result.some((item) => item.quantity > 20)) {
    throw new AppError(
      'You can order at most 20 units of a product',
      400,
      'PRODUCT_QUANTITY_LIMIT',
    );
  }
  const totalUnits = result.reduce((total, item) => total + item.quantity, 0);
  if (totalUnits > 50) {
    throw new AppError(
      'You can order at most 50 units in one order',
      400,
      'ORDER_QUANTITY_LIMIT',
    );
  }
  if (result.length === 0) {
    throw new AppError('Your cart is empty', 400, 'EMPTY_CART');
  }
  return result;
}

function idempotencyTarget(error: unknown): string[] {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.target;
    return Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  }
  return [];
}

async function getForActor(
  id: string,
  actor: AuthUser,
): Promise<OrderWithRelations> {
  const order = await repo.findById(id);
  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }
  if (actor.role === Role.CUSTOMER && order.customerId !== actor.id) {
    throw new AppError('You do not have access to this order', 403, 'FORBIDDEN');
  }
  if (
    actor.role === Role.DELIVERY_PARTNER &&
    order.deliveryPartnerId !== actor.id
  ) {
    throw new AppError('You do not have access to this order', 403, 'FORBIDDEN');
  }
  return order;
}

async function markDelivered(
  orderId: string,
  actor: AuthUser,
  note?: string,
) {
  const order = await repo.findById(orderId);
  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }
  if (
    actor.role === Role.DELIVERY_PARTNER &&
    order.deliveryPartnerId !== actor.id
  ) {
    throw new AppError('This order is not assigned to you', 403, 'FORBIDDEN');
  }
  if (order.status === 'DELIVERED') {
    return serializeOrder(order);
  }
  if (order.status !== 'OUT_FOR_DELIVERY') {
    throw new AppError(
      `Cannot mark a ${order.status.toLowerCase()} order as delivered`,
      409,
      'INVALID_TRANSITION',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, status: 'OUT_FOR_DELIVERY' },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        ...(order.paymentMethod === 'COD' ? { paymentStatus: 'PAID' } : {}),
      },
    });
    if (result.count !== 1) {
      throw new AppError(
        'Order status changed while completing delivery',
        409,
        'INVALID_TRANSITION',
      );
    }

    if (order.deliveryPartnerId) {
      await tx.deliveryPartner.update({
        where: { userId: order.deliveryPartnerId },
        data: {
          earnings: { increment: env.RIDER_PAYOUT },
          totalDeliveries: { increment: 1 },
        },
      });
    }

    // Money rails: points + tier from this order's spend.
    await earnLoyaltyOnDelivery(tx, order.customerId, orderId, order.total);

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'DELIVERED',
        note: note ?? 'Delivered',
        changedBy: actor.id,
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
  });

  notifyOrder(updated, 'DELIVERED');
  logger.info('Order delivered', {
    orderId,
    orderNumber: updated.orderNumber,
    actorId: actor.id,
  });
  return serializeOrder(updated);
}

async function cancelOrder(
  orderId: string,
  actor: AuthUser,
  reason: string,
) {
  const order = await repo.findById(orderId);
  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }
  if (actor.role === Role.CUSTOMER && order.customerId !== actor.id) {
    throw new AppError('You do not have access to this order', 403, 'FORBIDDEN');
  }
  if (actor.role === Role.DELIVERY_PARTNER) {
    throw new AppError('Riders cannot cancel orders', 403, 'FORBIDDEN');
  }

  const customerAllowed: OrderStatus[] = ['PENDING', 'CONFIRMED'];
  const adminAllowed: OrderStatus[] = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'ASSIGNED',
    'OUT_FOR_DELIVERY',
  ];
  const allowed =
    actor.role === Role.ADMIN ? adminAllowed : customerAllowed;
  if (!allowed.includes(order.status)) {
    throw new AppError(
      `A ${order.status.toLowerCase()} order cannot be cancelled`,
      409,
      'CANNOT_CANCEL',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
        deliveryPartnerId: null,
      },
    });
    if (result.count !== 1) {
      throw new AppError(
        'Order status changed while cancelling',
        409,
        'CANNOT_CANCEL',
      );
    }

    for (const item of order.items) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    // Money rails: return wallet balance and redeemed loyalty points.
    await refundOrderResources(
      tx,
      order.customerId,
      orderId,
      order.walletApplied,
      order.loyaltyPointsUsed,
    );

    // Free the reserved delivery slot.
    if (order.slotId) {
      await tx.deliverySlot.updateMany({
        where: { id: order.slotId, booked: { gt: 0 } },
        data: { booked: { decrement: 1 } },
      });
    }

    // Return flash-deal quota for live deals on the cancelled items.
    const now = new Date();
    const productIds = [...new Set(order.items.map((item) => item.productId))];
    const liveDeals = await tx.flashDeal.findMany({
      where: {
        productId: { in: productIds },
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });
    for (const deal of liveDeals) {
      await tx.flashDeal.updateMany({
        where: { id: deal.id, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }

    if (actor.role === Role.CUSTOMER) {
      await tx.riskFlag.create({
        data: {
          userId: actor.id,
          kind: 'RAPID_CANCEL',
          score: 1,
          note: reason.slice(0, 200),
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'CANCELLED',
        note: `Cancelled: ${reason}`,
        changedBy: actor.id,
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
  });

  notifyOrder(updated, 'CANCELLED');
  logger.info('Order cancelled', {
    orderId,
    orderNumber: updated.orderNumber,
    actorId: actor.id,
  });
  return serializeOrder(updated);
}

export const orderService = {
  async place(
    customerId: string,
    input: CreateOrderInput,
    idempotencyKey?: string,
  ) {
    const isUpiPayment = input.paymentMethod === 'online';
    if (
      idempotencyKey &&
      !/^[A-Za-z0-9._-]{8,128}$/.test(idempotencyKey)
    ) {
      throw new AppError(
        'Invalid Idempotency-Key header',
        422,
        'INVALID_IDEMPOTENCY_KEY',
      );
    }

    if (idempotencyKey) {
      const existing = await repo.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.customerId !== customerId) {
          throw new AppError('Idempotency key conflict', 409, 'IDEMPOTENCY_KEY_CONFLICT');
        }
        return serializeOrder(existing);
      }
    }

    const items = mergeItems(input.items);
    if (input.upiUtrLast4 && !isUpiPayment) {
      throw new AppError(
        'UPI reference numbers only apply to UPI payments',
        422,
        'UTR_NOT_ALLOWED',
      );
    }
    if (input.slotId && input.fulfilment === 'pickup') {
      throw new AppError(
        'Store pickup does not use delivery slots',
        422,
        'SLOT_NOT_ALLOWED',
      );
    }
    let created: OrderWithRelations | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const address = await tx.address.findFirst({
              where: { id: input.addressId, userId: customerId },
            });
            if (!address) {
              const exists = await tx.address.findUnique({
                where: { id: input.addressId },
              });
              if (exists) {
                throw new AppError(
                  'This address does not belong to you',
                  403,
                  'ADDRESS_NOT_OWNED',
                );
              }
              throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
            }
            assertServiceablePincode(address.pincode);

            const store = await tx.store.findFirst();
            if (!store) {
              throw new AppError(
                'Store is not configured',
                500,
                'STORE_NOT_CONFIGURED',
              );
            }
            if (!isStoreOpenNow(store)) {
              throw new AppError(
                `NeuraCart is closed. Orders are accepted ${store.openTime}–${store.closeTime} IST.`,
                400,
                'STORE_CLOSED',
              );
            }
            if (input.fulfilment === 'pickup' && !store.pickupEnabled) {
              throw new AppError(
                'Store pickup is temporarily unavailable',
                400,
                'PICKUP_DISABLED',
              );
            }

            const products = await tx.product.findMany({
              where: { id: { in: items.map((item) => item.productId) } },
            });
            const byId = new Map(products.map((product) => [product.id, product]));

            // Live flash deals change what customers actually pay.
            const now = new Date();
            const deals = await tx.flashDeal.findMany({
              where: {
                isActive: true,
                startsAt: { lte: now },
                endsAt: { gte: now },
                productId: { in: items.map((item) => item.productId) },
              },
            });
            const dealPct = new Map<string, number>();
            for (const deal of deals) {
              if (deal.stockLimit !== null && deal.usedCount >= deal.stockLimit) continue;
              dealPct.set(deal.productId, deal.discountPct);
            }

            let subtotal = new Prisma.Decimal(0);
            const resolved = items.map((item) => {
              const product = byId.get(item.productId);
              if (!product || !product.isActive) {
                throw new AppError(
                  `Product is no longer available: ${product?.name ?? item.productId}`,
                  400,
                  'PRODUCT_UNAVAILABLE',
                );
              }
              if (product.stock < item.quantity) {
                throw new AppError(
                  `Only ${product.stock} ${product.unit} of ${product.name} left`,
                  409,
                  'INSUFFICIENT_STOCK',
                  { productId: product.id, productName: product.name, available: product.stock },
                );
              }
              const pct = dealPct.get(item.productId) ?? 0;
              const unitPrice =
                pct > 0
                  ? product.price.mul(1 - Math.min(pct, env.FLASH_DEAL_MAX_PCT) / 100)
                  : product.price;
              subtotal = subtotal.plus(unitPrice.mul(item.quantity));
              return { product, quantity: item.quantity, unitPrice };
            });

            for (const item of resolved) {
              const stockUpdate = await tx.product.updateMany({
                where: {
                  id: item.product.id,
                  isActive: true,
                  stock: { gte: item.quantity },
                },
                data: { stock: { decrement: item.quantity } },
              });
              if (stockUpdate.count !== 1) {
                throw new AppError(
                  `${item.product.name} just went out of stock`,
                  409,
                  'INSUFFICIENT_STOCK',
                  { productId: item.product.id, productName: item.product.name },
                );
              }
            }

            const fulfilment = input.fulfilment === 'pickup' ? Fulfilment.PICKUP : Fulfilment.DELIVERY;
            // Weather surge is charged on delivery orders only, on top of the base fee.
            const surge =
              fulfilment === Fulfilment.PICKUP || store.weatherMode === 'NORMAL'
                ? new Prisma.Decimal(0)
                : store.surgeFee;
            const deliveryFee = (
              fulfilment === Fulfilment.PICKUP ||
              subtotal.greaterThanOrEqualTo(store.freeDeliveryAbove)
                ? new Prisma.Decimal(0)
                : store.deliveryFee
            ).plus(surge);

            // Reserve the delivery slot capacity first.
            let slot: Prisma.DeliverySlotGetPayload<Record<string, never>> | null = null;
            if (input.slotId) {
              const slotRow = await tx.deliverySlot.findUnique({
                where: { id: input.slotId },
              });
              if (!slotRow || !slotRow.isActive) {
                throw new AppError(
                  'That delivery slot is unavailable',
                  404,
                  'SLOT_UNAVAILABLE',
                );
              }
              if (slotRow.date.getTime() + 24 * 3600_000 <= Date.now()) {
                throw new AppError(
                  'That delivery slot has already passed',
                  400,
                  'SLOT_UNAVAILABLE',
                );
              }
              const reserved = await tx.deliverySlot.updateMany({
                where: {
                  id: input.slotId,
                  isActive: true,
                  booked: { lt: slotRow.capacity },
                },
                data: { booked: { increment: 1 } },
              });
              if (reserved.count !== 1) {
                throw new AppError(
                  'That delivery slot just filled up',
                  409,
                  'SLOT_UNAVAILABLE',
                );
              }
              slot = slotRow;
            }

            // Pre-read money rails (debits happen after the order row exists).
            const walletRow = input.walletApply
              ? await tx.wallet.upsert({ where: { userId: customerId }, update: {}, create: { userId: customerId } })
              : null;
            const loyaltyRow = input.loyaltyApply
              ? await tx.loyaltyAccount.upsert({ where: { userId: customerId }, update: {}, create: { userId: customerId } })
              : null;

            const maxLoyaltyAmount = subtotal.mul(env.LOYALTY_MAX_REDEEM_PCT / 100);
            const maxLoyaltyPoints = Math.floor(
              maxLoyaltyAmount.div(env.LOYALTY_POINT_VALUE).toNumber(),
            );
            const loyaltyPointsUsed =
              input.loyaltyApply && loyaltyRow
                ? Math.min(loyaltyRow.points, maxLoyaltyPoints)
                : 0;
            const loyaltyAmount = new Prisma.Decimal(loyaltyPointsUsed).mul(env.LOYALTY_POINT_VALUE);

            const dueBeforeWallet = subtotal.plus(deliveryFee).minus(loyaltyAmount);
            const walletApplied =
              input.walletApply && walletRow
                ? Prisma.Decimal.min(walletRow.balance, dueBeforeWallet)
                : new Prisma.Decimal(0);

            const total = dueBeforeWallet.minus(walletApplied);
            const walletCoversEverything = subtotal
              .plus(deliveryFee)
              .minus(loyaltyAmount)
              .minus(walletApplied)
              .lessThanOrEqualTo(0);
            const orderNumber = await nextOrderNumber(tx);
            const estimatedAt = new Date(Date.now() + 45 * 60_000);

            const createdOrder = await tx.order.create({
              data: {
                orderNumber,
                customerId,
                addressId: address.id,
                status: 'PENDING',
                paymentStatus: walletCoversEverything ? 'PAID' : 'PENDING',
                paymentMethod: isUpiPayment ? PaymentMethod.ONLINE : PaymentMethod.COD,
                subtotal,
                deliveryFee,
                discount: loyaltyAmount,
                total,
                notes: input.notes?.trim() || null,
                idempotencyKey: idempotencyKey ?? null,
                estimatedAt,
                fulfilment,
                slotId: slot?.id ?? null,
                pickupAt: fulfilment === Fulfilment.PICKUP ? estimatedAt : null,
                walletApplied,
                loyaltyPointsUsed,
                items: {
                  create: resolved.map((item) => ({
                    productId: item.product.id,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.unitPrice.mul(item.quantity),
                  })),
                },
                statusHistory: {
                  create: {
                    status: 'PENDING',
                    note: 'Order is placed',
                    changedBy: customerId,
                  },
                },
                ...(fulfilment === Fulfilment.DELIVERY
                  ? {
                      tracking: {
                        create: {
                          storeLatitude: store.latitude,
                          storeLongitude: store.longitude,
                          customerLatitude: address.latitude,
                          customerLongitude: address.longitude,
                        },
                      },
                    }
                  : {}),
              },
              include: orderInclude,
            });

            // Settle the money rails with the real order id.
            const settledPaymentRef: string[] = [];
            if (isUpiPayment && input.upiUtrLast4) {
              const ack = makeUpiAck(createdOrder.orderNumber, input.upiUtrLast4);
              settledPaymentRef.push(ack.paymentRef);
              await tx.walletTransaction.create({
                data: {
                  userId: customerId,
                  orderId: createdOrder.id,
                  type: WalletTxnType.CASHBACK,
                  amount: new Prisma.Decimal(0),
                  note: ack.txnNote,
                },
              });
            }

            if (loyaltyPointsUsed > 0) {
              await tx.loyaltyAccount.update({
                where: { userId: customerId },
                data: { points: { decrement: loyaltyPointsUsed } },
              });
              await tx.walletTransaction.create({
                data: {
                  userId: customerId,
                  orderId: createdOrder.id,
                  type: WalletTxnType.REDEEM,
                  amount: loyaltyAmount.negated(),
                  note: `Loyalty: ${loyaltyPointsUsed} points redeemed`,
                },
              });
            }

            if (walletApplied.greaterThan(0)) {
              const settled = await tx.wallet.updateMany({
                where: { userId: customerId, balance: { gte: walletApplied } },
                data: { balance: { decrement: walletApplied } },
              });
              if (settled.count !== 1) {
                throw new AppError('Wallet balance changed while paying', 409, 'WALLET_CHANGED');
              }
              await tx.walletTransaction.create({
                data: {
                  userId: customerId,
                  orderId: createdOrder.id,
                  type: WalletTxnType.REDEEM,
                  amount: walletApplied.negated(),
                  note: 'Wallet redemption at checkout',
                },
              });
              if (walletCoversEverything && !isUpiPayment) {
                settledPaymentRef.push('WALLET');
              }
            }

            if (settledPaymentRef.length > 0) {
              await tx.order.update({
                where: { id: createdOrder.id },
                data: {
                  paymentRef: settledPaymentRef[0],
                  ...(settledPaymentRef.includes('WALLET') ? { paymentStatus: 'PAID' } : {}),
                },
              });
            }

            for (const deal of deals) {
              if (dealPct.get(deal.productId) !== deal.discountPct) continue;
              const counted = await tx.flashDeal.updateMany({
                where: {
                  id: deal.id,
                  isActive: true,
                  startsAt: { lte: now },
                  endsAt: { gte: now },
                  OR: [{ stockLimit: null }, { usedCount: { lt: deal.stockLimit ?? 10_000_000 } }],
                },
                data: { usedCount: { increment: 1 } },
              });
              if (counted.count !== 1) {
                throw new AppError(
                  'That flash deal just sold out — the price has been updated',
                  409,
                  'DEAL_SOLD_OUT',
                );
              }
            }

            if (input.referralCode) {
              await moneyService.applyReferral(customerId, input.referralCode, tx);
            }

            // Re-read with UPI/wallet settlement for the notify pipeline.
            const finalOrder = await tx.order.findUniqueOrThrow({
              where: { id: createdOrder.id },
              include: orderInclude,
            });
            return finalOrder;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        const target = idempotencyTarget(error);
        if (target.includes('idempotencyKey') && idempotencyKey) {
          const existing = await repo.findByIdempotencyKey(idempotencyKey);
          if (existing) {
            if (existing.customerId !== customerId) {
              throw new AppError(
                'Idempotency key conflict',
                409,
                'IDEMPOTENCY_KEY_CONFLICT',
              );
            }
            return serializeOrder(existing);
          }
        }
        if (target.includes('orderNumber') && attempt < 2) {
          continue;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!created) {
      throw new AppError(
        'Could not place order. Please try again.',
        409,
        'ORDER_CONFLICT',
      );
    }

    notifyOrder(created, 'PENDING');
    logger.info('Order placed', {
      orderId: created.id,
      orderNumber: created.orderNumber,
      customerId,
      total: created.total.toFixed(2),
    });
    return addUpiIntent(created);
  },

  async listMy(customerId: string, query: CustomerOrderListQuery) {
    const pagination = getPaginationParams(query.page, query.limit, 20, 50);
    const [orders, total] = await repo.listCustomer(
      customerId,
      pagination.skip,
      pagination.limit,
    );
    return {
      data: orders.map(serializeOrder),
      pagination: getPaginationMeta(
        pagination.page,
        pagination.limit,
        total,
      ),
    };
  },

  async getById(id: string, actor: AuthUser) {
    return serializeOrder(await getForActor(id, actor));
  },

  async adminList(query: AdminOrderListQuery) {
    if (query.from && query.to && query.from > query.to) {
      throw new AppError('From date must be before to date', 422, 'INVALID_DATE_RANGE');
    }
    const pagination = getPaginationParams(query.page, query.limit, 20, 50);
    const search = query.search?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { customer: { email: { contains: search, mode: 'insensitive' } } },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
    };

    const [orders, total] = await repo.listAdmin(
      where,
      pagination.skip,
      pagination.limit,
    );
    return {
      data: orders.map(serializeOrder),
      pagination: getPaginationMeta(
        pagination.page,
        pagination.limit,
        total,
      ),
    };
  },

  async cancel(id: string, actor: AuthUser, reason: string) {
    return cancelOrder(id, actor, reason);
  },

  /**
   * Customer acknowledges paying a UPI order: stores the UTR claim for admin
   * review. Only own, ONLINE, still-pending orders can be acked.
   */
  async upiAck(orderId: string, customerId: string, upiUtrLast4: string) {
    const order = await repo.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.customerId !== customerId) {
      throw new AppError('You do not have access to this order', 403, 'FORBIDDEN');
    }
    if (order.paymentMethod !== PaymentMethod.ONLINE) {
      throw new AppError('This order is not a UPI payment', 409, 'NOT_UPI_ORDER');
    }
    if (order.paymentStatus !== 'PENDING') {
      throw new AppError(
        'This payment is already settled',
        409,
        'PAYMENT_SETTLED',
      );
    }
    if (order.paymentRef?.startsWith('upi-acked')) {
      throw new AppError('You have already reported this payment', 409, 'PAYMENT_ACKED');
    }

    const ack = makeUpiAck(order.orderNumber, upiUtrLast4);
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentRef: ack.paymentRef },
      });
      await tx.walletTransaction.create({
        data: {
          userId: customerId,
          orderId,
          type: WalletTxnType.CASHBACK,
          amount: new Prisma.Decimal(0),
          note: ack.txnNote,
        },
      });
    });
    logger.info('UPI payment acknowledged', {
      orderId,
      orderNumber: order.orderNumber,
    });
    return addUpiIntent(order);
  },

  async updateStatus(
    id: string,
    actor: AuthUser,
    input: UpdateOrderStatusInput,
  ) {
    const order = await repo.findById(id);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    const target = input.status as OrderStatus;
    if (target === 'CANCELLED') {
      return cancelOrder(id, actor, input.note ?? 'Cancelled by store');
    }
    if (target === 'DELIVERED') {
      return markDelivered(id, actor, input.note);
    }
    if (target === 'ASSIGNED') {
      throw new AppError(
        'Use the assign endpoint to attach a rider',
        400,
        'USE_ASSIGN_ENDPOINT',
      );
    }
    if (!TRANSITIONS[order.status].includes(target)) {
      throw new AppError(
        `Cannot move order from ${order.status.toLowerCase()} to ${target.toLowerCase()}`,
        409,
        'INVALID_TRANSITION',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: target,
          ...(target === 'OUT_FOR_DELIVERY' && !order.estimatedAt
            ? { estimatedAt: new Date(Date.now() + 30 * 60_000) }
            : {}),
        },
      });
      if (result.count !== 1) {
        throw new AppError(
          'Order status changed while updating',
          409,
          'INVALID_TRANSITION',
        );
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: target,
          note: input.note ?? `Status changed to ${target.toLowerCase()}`,
          changedBy: actor.id,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });

    notifyOrder(updated, target);
    logger.info('Order status updated', {
      orderId: id,
      status: target,
      actorId: actor.id,
    });
    return serializeOrder(updated);
  },

  async assign(id: string, actor: AuthUser, input: AssignOrderInput) {
    const order = await repo.findById(id);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (!['PREPARING', 'ASSIGNED'].includes(order.status)) {
      throw new AppError(
        'Assign a rider after the order is being prepared',
        409,
        'INVALID_TRANSITION',
      );
    }
    if (
      order.status === 'ASSIGNED' &&
      order.deliveryPartnerId === input.partnerId
    ) {
      return serializeOrder(order);
    }

    const partner = await repo.findPartnerUser(input.partnerId);
    if (!partner || partner.role !== Role.DELIVERY_PARTNER) {
      throw new AppError('Rider not found', 404, 'RIDER_NOT_FOUND');
    }
    if (!partner.isActive) {
      throw new AppError('Rider is inactive', 400, 'RIDER_INACTIVE');
    }
    if (!partner.deliveryProfile?.isVerified) {
      throw new AppError('Rider is not verified', 400, 'RIDER_NOT_VERIFIED');
    }
    if (!partner.deliveryProfile.isAvailable) {
      throw new AppError('Rider is not available', 400, 'RIDER_UNAVAILABLE');
    }

    const activeAssignments = await repo.countActiveAssignments(input.partnerId);
    if (activeAssignments >= env.MAX_ACTIVE_ASSIGNMENTS) {
      throw new AppError(
        `Rider already has ${env.MAX_ACTIVE_ASSIGNMENTS} active assignments`,
        409,
        'RIDER_AT_CAPACITY',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: 'ASSIGNED', deliveryPartnerId: input.partnerId },
      });
      if (result.count !== 1) {
        throw new AppError(
          'Order status changed while assigning',
          409,
          'INVALID_TRANSITION',
        );
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'ASSIGNED',
          note: input.note ?? `Assigned to ${partner.name ?? 'rider'}`,
          changedBy: actor.id,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });

    notifyOrder(updated, 'ASSIGNED');
    if (partner.email) {
      void sendRiderAssignmentEmail({
        to: partner.email,
        riderName: partner.name ?? 'rider',
        orderNumber: updated.orderNumber,
        deliveryArea: [updated.address.line1, updated.address.city, updated.address.pincode]
          .filter(Boolean)
          .join(', '),
        total: updated.total.toFixed(2),
        payout: env.RIDER_PAYOUT.toFixed(2),
      }).catch((error: unknown) => {
        logger.error('Could not send rider assignment email', {
          orderId: id,
          riderId: input.partnerId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }
    logger.info('Rider assigned', {
      orderId: id,
      riderId: input.partnerId,
      actorId: actor.id,
    });
    return serializeOrder(updated);
  },

  async updateTracking(
    id: string,
    actor: AuthUser,
    input: OrderTrackingInput,
  ) {
    const order = await repo.findById(id);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (
      actor.role === Role.DELIVERY_PARTNER &&
      order.deliveryPartnerId !== actor.id
    ) {
      throw new AppError('This order is not assigned to you', 403, 'FORBIDDEN');
    }
    if (!['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      throw new AppError(
        'Tracking is only available for active deliveries',
        409,
        'TRACKING_UNAVAILABLE',
      );
    }
    if (
      order.tracking &&
      order.tracking.latitude !== null &&
      order.tracking.longitude !== null &&
      Date.now() - order.tracking.updatedAt.getTime() < 10_000
    ) {
      return order.tracking;
    }

    const store = await repo.findStore();
    if (!store) {
      throw new AppError('Store is not configured', 500, 'STORE_NOT_CONFIGURED');
    }
    return repo.upsertTracking(id, {
      latitude: input.latitude,
      longitude: input.longitude,
      storeLatitude: store.latitude,
      storeLongitude: store.longitude,
      customerLatitude: order.address.latitude,
      customerLongitude: order.address.longitude,
    });
  },

  async getTracking(id: string, actor: AuthUser) {
    const order = await getForActor(id, actor);
    if (!order.tracking) {
      throw new AppError('Tracking is not available yet', 404, 'TRACKING_NOT_FOUND');
    }
    return order.tracking;
  },

  async completeByRider(id: string, riderId: string, note?: string) {
    return markDelivered(
      id,
      { id: riderId, email: '', name: null, role: Role.DELIVERY_PARTNER },
      note ?? 'Delivered by rider',
    );
  },
};
