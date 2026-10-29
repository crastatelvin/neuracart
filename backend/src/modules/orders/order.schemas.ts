import { z } from 'zod';

const orderStatus = z
  .enum([
    'pending',
    'confirmed',
    'preparing',
    'assigned',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ])
  .transform(
    (value) =>
      value.toUpperCase() as
        | 'PENDING'
        | 'CONFIRMED'
        | 'PREPARING'
        | 'ASSIGNED'
        | 'OUT_FOR_DELIVERY'
        | 'DELIVERED'
        | 'CANCELLED',
  );

const paymentStatus = z
  .enum(['pending', 'paid', 'failed', 'refunded'])
  .transform(
    (value) =>
      value.toUpperCase() as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
  );

export const createOrderSchema = z.object({
  addressId: z.string().uuid('Choose a valid address'),
  paymentMethod: z.enum(['cod', 'online']).default('cod'),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product'),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1, 'Your cart is empty')
    .max(50),
  notes: z.string().trim().max(500).optional(),
  // ——— v2 checkout: fulfilment, scheduling, money ———
  fulfilment: z.enum(['delivery', 'pickup']).default('delivery'),
  slotId: z.string().uuid('Choose a valid slot').optional(),
  walletApply: z.boolean().default(false),
  loyaltyApply: z.boolean().default(false),
  referralCode: z.string().trim().min(4).max(12).optional(),
  upiUtrLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the last 4 digits of your UPI reference')
    .optional(),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Tell us why you are cancelling')
    .max(300),
});

export const upiAckSchema = z.object({
  upiUtrLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the last 4 digits of your UPI reference'),
});

export const customerOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: orderStatus.optional(),
  paymentStatus: paymentStatus.optional(),
  paymentMethod: z
    .enum(['cod', 'online'])
    .transform((value) => value.toUpperCase() as 'COD' | 'ONLINE')
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: orderStatus,
  note: z.string().trim().max(300).optional(),
});

export const assignOrderSchema = z.object({
  partnerId: z.string().uuid('Choose a valid rider'),
  note: z.string().trim().max(300).optional(),
});

export const orderTrackingSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type UpiAckInput = z.infer<typeof upiAckSchema>;
export type CustomerOrderListQuery = z.infer<
  typeof customerOrderListQuerySchema
>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type AssignOrderInput = z.infer<typeof assignOrderSchema>;
export type OrderTrackingInput = z.infer<typeof orderTrackingSchema>;
