const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

export type EarningsPeriod = 'today' | 'week' | 'month' | 'all';

function shifted(now: Date): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

export function istMinutes(now = new Date()): number {
  const local = shifted(now);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function startOfIstDay(now = new Date()): Date {
  const local = shifted(now);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      IST_OFFSET_MS,
  );
}

export function startOfIstDaysAgo(daysAgo: number, now = new Date()): Date {
  return new Date(
    startOfIstDay(now).getTime() - daysAgo * 24 * 60 * 60_000,
  );
}

export function startOfIstWeek(now = new Date()): Date {
  const local = shifted(now);
  const day = local.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - daysFromMonday,
    ) - IST_OFFSET_MS,
  );
}

export function startOfIstMonth(now = new Date()): Date {
  const local = shifted(now);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - IST_OFFSET_MS,
  );
}

export function startOfIstPeriod(
  period: EarningsPeriod,
  now = new Date(),
): Date | null {
  switch (period) {
    case 'today':
      return startOfIstDay(now);
    case 'week':
      return startOfIstWeek(now);
    case 'month':
      return startOfIstMonth(now);
    case 'all':
      return null;
  }
}

export function formatIstDate(date: Date): string {
  return shifted(date).toISOString().slice(0, 10);
}
