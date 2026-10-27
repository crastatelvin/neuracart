import type { OrderStatus, PaymentMethod, PaymentStatus } from './types';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function money(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return `₹${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(safe)}`;
  } catch {
    return `₹${Math.round(safe)}`;
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
  } catch {
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear();
    let hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${day} ${month} ${year}, ${hour}:${minute} ${suffix}`;
  }
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }
}

export function relativeTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function firstName(name: string | null | undefined): string {
  if (!name?.trim()) return 'there';
  return name.trim().split(/\s+/)[0];
}

export function greetingFor(date = new Date()): string {
  let hour = date.getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(date),
    );
  } catch {
    // Fall back to the device clock when Intl time zones are unavailable.
  }
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string | null | undefined, email?: string): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  return email?.slice(0, 2).toUpperCase() ?? 'LM';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function formatAddress(
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  },
  includeCity = true,
): string {
  const parts = [address.line1, address.line2, includeCity ? address.city : null, address.state, address.pincode];
  return parts.filter(Boolean).join(', ');
}

export const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: string; text: string; background: string }
> = {
  pending: {
    label: 'Pending',
    icon: 'time-outline',
    text: '#B45309',
    background: '#FFFBEB',
  },
  confirmed: {
    label: 'Confirmed',
    icon: 'checkmark-circle-outline',
    text: '#1D4ED8',
    background: '#EFF6FF',
  },
  preparing: {
    label: 'Preparing',
    icon: 'basket-outline',
    text: '#7E22CE',
    background: '#FAF5FF',
  },
  assigned: {
    label: 'Rider assigned',
    icon: 'bicycle-outline',
    text: '#4338CA',
    background: '#EEF2FF',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    icon: 'navigate-outline',
    text: '#C2410C',
    background: '#FFF7ED',
  },
  delivered: {
    label: 'Delivered',
    icon: 'checkmark-done-outline',
    text: '#15803D',
    background: '#F0FDF4',
  },
  cancelled: {
    label: 'Cancelled',
    icon: 'close-circle-outline',
    text: '#B91C1C',
    background: '#FEF2F2',
  },
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'assigned',
  'out_for_delivery',
];

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

export const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'assigned',
  'out_for_delivery',
  'delivered',
];

export function statusProgress(status: OrderStatus): number {
  if (status === 'delivered') return 1;
  if (status === 'cancelled') return 0;
  const index = ORDER_FLOW.indexOf(status);
  return index < 0 ? 0 : Math.max(0.08, index / (ORDER_FLOW.length - 1));
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  online: 'Online payment',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

/** Hide customer phone numbers until the rider accepts the assignment. */
export function maskPhone(phone: string | null, unmasked: boolean): string {
  if (!phone) return '—';
  if (unmasked) return phone;
  if (phone.length <= 4) return '••••••••';
  return `${phone.slice(0, phone.length - 4).replace(/\d/g, '•')}${phone.slice(-4)}`;
}

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
