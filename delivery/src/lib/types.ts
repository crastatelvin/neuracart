export type UserRole = 'customer' | 'admin' | 'delivery_partner';

export type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
};

export type DeliveryProfile = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  vehicleType: string;
  vehicleNumber: string;
  isAvailable: boolean;
  isVerified: boolean;
  totalDeliveries: number;
  earnings: string;
  rating: string | null;
  memberSince: string;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  total: string;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    unit: string;
    category: 'fruits' | 'vegetables' | 'meat';
    isActive: boolean;
  };
};

export type OrderStatusHistory = {
  id: string;
  status: OrderStatus;
  note: string | null;
  changedBy: string | null;
  createdAt: string;
};

export type OrderTracking = {
  latitude: number | null;
  longitude: number | null;
  storeLatitude: number;
  storeLongitude: number;
  customerLatitude: number | null;
  customerLongitude: number | null;
  updatedAt: string;
};

/** Serialized order as returned by the backend (`serializeOrder`). */
export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  payout: string | null;
  accepted: boolean;
  fulfilment?: 'delivery' | 'pickup';
  slotId?: string | null;
  batchId?: string | null;
  notes: string | null;
  estimatedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
  };
  address: {
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    latitude: number | null;
    longitude: number | null;
  };
  items: OrderItem[];
  itemCount: number;
  statusHistory: OrderStatusHistory[];
  tracking: OrderTracking | null;
};

/** `GET /delivery/assignments?status=all` payload. */
export type Assignments = {
  new: Order[];
  ready: Order[];
  active: Order[];
  completed: Order[];
  counts: {
    new: number;
    ready: number;
    active: number;
    completed: number;
    current: number;
  };
};

export type EarningsPeriod = 'today' | 'week' | 'month' | 'all';

/** `GET /delivery/earnings?period=…` payload. */
export type Earnings = {
  period: EarningsPeriod;
  total: string;
  deliveries: number;
  average: string;
  payoutPerDelivery: string;
  history: {
    id: string;
    orderNumber: string;
    deliveredAt: string | null;
    payout: string;
    customerName: string;
    customerArea: string;
  }[];
  lifetime: {
    deliveries: number;
    earnings: string;
  };
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
  code?: string;
  errors?: unknown;
};
