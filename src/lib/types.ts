export type UserRole = 'customer' | 'admin' | 'delivery_partner';

export type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
};

export type MeResponse = User & {
  deliveryProfile?: {
    vehicleType: string;
    vehicleNumber: string;
    isAvailable: boolean;
    isVerified: boolean;
    totalDeliveries: number;
    earnings: string;
  } | null;
};

export type ProductCategory = 'fruits' | 'vegetables' | 'meat';

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  price: string;
  unit: string;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreInfo = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  openTime: string;
  closeTime: string;
  deliveryFee: string;
  freeDeliveryAbove: string;
  isOpen: boolean;
  manuallyOpen: boolean;
  timezone: string;
  updatedAt: string;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
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
    category: ProductCategory;
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
  deliveryPartner: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
  } | null;
  address: Omit<Address, 'isDefault' | 'createdAt' | 'updatedAt'>;
  items: OrderItem[];
  itemCount: number;
  statusHistory: OrderStatusHistory[];
  tracking: OrderTracking | null;
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
