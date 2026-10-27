export type Role = 'admin' | 'customer' | 'delivery_partner';

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: 'fruits' | 'vegetables' | 'meat';
  price: string;
  unit: string;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'online';

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
};

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
    category: string;
    isActive: boolean;
  };
};

export type RiderSummary = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  deliveryProfile?: {
    vehicleType?: string;
    vehicleNumber?: string;
    isVerified?: boolean;
    isAvailable?: boolean;
  } | null;
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
  deliveryPartner: RiderSummary | null;
  address: Address;
  items: OrderItem[];
  itemCount: number;
  statusHistory: {
    id: string;
    status: OrderStatus;
    note: string | null;
    changedBy: string | null;
    createdAt: string;
  }[];
  tracking: {
    latitude: number | null;
    longitude: number | null;
    storeLatitude: number;
    storeLongitude: number;
    customerLatitude: number | null;
    customerLongitude: number | null;
    updatedAt: string;
  } | null;
};

export type DeliveryPartner = {
  id: string;
  profileId: string;
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  vehicleType: string;
  vehicleNumber: string;
  isAvailable: boolean;
  isVerified: boolean;
  isActive: boolean;
  activeAssignments: number;
  totalDeliveries: number;
  earnings: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type Store = {
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

export type DashboardStats = {
  range: 'today' | '7d' | '30d';
  todayOrders: number;
  todayRevenue: string;
  pendingOrders: number;
  activeDeliveries: number;
  averageOrderValue: string;
  lowStockCount: number;
  totalCustomers: number;
  ordersByStatus: Record<Exclude<OrderStatus, never>, number>;
  revenueSeries: { date: string; revenue: string; orders: number }[];
  lowStock: { id: string; name: string; stock: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    total: string;
    itemCount: number;
    customer: { id: string; name: string | null; email: string };
    createdAt: string;
  }[];
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};
