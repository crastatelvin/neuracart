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

export function formatINR(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)}`;
}

export function formatDateIST(value: string | Date | null | undefined): string {
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
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }
}

export function formatTimeIST(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
  } catch {
    return date.toLocaleTimeString();
  }
}

export function formatDayLabel(value: string): string {
  const date = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  if (hours < 48) return 'Yesterday';
  return formatDateIST(date);
}

export const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  assigned: 'Assigned',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
} as const;

export const STATUS_TONE = {
  pending: 'amber',
  confirmed: 'blue',
  preparing: 'purple',
  assigned: 'indigo',
  out_for_delivery: 'orange',
  delivered: 'green',
  cancelled: 'red',
} as const;

export const PAYMENT_STATUS_LABEL = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
} as const;

export const PAYMENT_METHOD_LABEL = {
  cod: 'COD',
  online: 'Online',
} as const;

export const ACTIVE_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'assigned',
  'out_for_delivery',
] as const;

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function initials(name: string | null | undefined, fallback = 'LM'): string {
  if (!name?.trim()) return fallback.slice(0, 2).toUpperCase();
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatAddress(address: {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}): string {
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

export function startOfTodayISO(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - istOffset).toISOString();
}
