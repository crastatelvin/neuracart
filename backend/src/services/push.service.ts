import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

/**
 * Expo push notifications. Keyless and free; tokens are registered by the apps
 * after login. Failures never block an order transition.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function registerPushToken(input: {
  userId: string;
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
}): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token: input.token },
    create: {
      userId: input.userId,
      token: input.token,
      platform: input.platform,
    },
    update: { userId: input.userId, platform: input.platform, isActive: true },
  });
}

export async function removePushToken(token: string): Promise<void> {
  await prisma.pushToken.updateMany({
    where: { token },
    data: { isActive: false },
  });
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId, isActive: true },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tokens.map((entry) => ({
          to: entry.token,
          title,
          body,
          data,
          sound: 'default',
        })),
      ),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`expo push ${response.status}`);
    const json = (await response.json()) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    const dead = (json.data ?? [])
      .map((ticket, index) => ({ ticket, token: tokens[index]?.token }))
      .filter(
        (entry) =>
          entry.ticket.status === 'error' &&
          entry.ticket.details?.error === 'DeviceNotRegistered',
      )
      .map((entry) => entry.token)
      .filter((token): token is string => Boolean(token));
    if (dead.length > 0) {
      await prisma.pushToken.updateMany({
        where: { token: { in: dead } },
        data: { isActive: false },
      });
    }
  } catch (error) {
    logger.warn('Push notification failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
