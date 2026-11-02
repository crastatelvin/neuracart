import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { sendEmail } from '../../services/email.service';
import { saveProductImage } from '../../services/upload.service';
import { AppError } from '../../utils/errors';
import { hashOtp, verifyOtpHash } from '../../utils/otp';
import { logger } from '../../utils/logger';

/**
 * Logistics: live rider position, weather surge, dispatch suggestions, two-order
 * batching and proof of delivery. Every external call (open-meteo, email) is
 * best-effort — a failed lookup never blocks a delivery.
 */

const LOCATION_THROTTLE_MS = 15_000;
const WEATHER_TIMEOUT_MS = 4_000;

export type WeatherMode = 'NORMAL' | 'RAIN' | 'HEAVY';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function liveWeather(): Promise<{ mode: WeatherMode; note: string }> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${env.WEATHER_LAT}&longitude=${env.WEATHER_LON}&current=precipitation,weather_code`,
      { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) },
    );
    if (!response.ok) throw new Error(`open-meteo ${response.status}`);
    const json = (await response.json()) as {
      current?: { precipitation?: number; weather_code?: number };
    };
    const code = json.current?.weather_code ?? 0;
    const rain = json.current?.precipitation ?? 0;
    if (code >= 95) return { mode: 'HEAVY', note: 'Thunderstorms' };
    if (code >= 80 || rain >= 4) return { mode: 'HEAVY', note: 'Heavy showers' };
    if ((code >= 51 && code <= 67) || rain > 0) {
      return { mode: 'RAIN', note: 'Light rain' };
    }
    return { mode: 'NORMAL', note: 'Clear' };
  } catch (error) {
    logger.warn('Weather lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { mode: 'NORMAL', note: 'Weather unavailable' };
  }
}

async function weather() {
  const store = await prisma.store.findFirst();
  if (!store) throw new AppError('Store is not configured', 500, 'STORE_NOT_CONFIGURED');
  const manual = env.WEATHER_MODE_MANUAL;
  const live =
    manual === 'auto'
      ? await liveWeather()
      : { mode: manual.toUpperCase() as WeatherMode, note: `Manual: ${manual}` };
  return {
    mode: live.mode,
    note: store.weatherNote ?? live.note,
    surgeFee: store.surgeFee.toFixed(2),
    etaMinutes: live.mode === 'HEAVY' ? 65 : live.mode === 'RAIN' ? 55 : 45,
  };
}

async function updateLocation(userId: string, latitude: number, longitude: number) {
  const partner = await prisma.deliveryPartner.findUnique({ where: { userId } });
  if (!partner) throw new AppError('Delivery partner not found', 404, 'PARTNER_NOT_FOUND');
  if (Date.now() - partner.updatedAt.getTime() < LOCATION_THROTTLE_MS) {
    return { throttled: true };
  }
  await prisma.deliveryPartner.update({
    where: { userId },
    data: { currentLat: latitude, currentLng: longitude },
  });
  const active = await prisma.order.findFirst({
    where: {
      deliveryPartnerId: userId,
      status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
    },
    select: { id: true },
  });
  if (active) {
    await prisma.orderTracking.updateMany({
      where: { orderId: active.id },
      data: { latitude, longitude },
    });
  }
  return { throttled: false };
}

async function dispatchSuggestions(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  const store = await prisma.store.findFirst();
  const partners = await prisma.deliveryPartner.findMany({
    where: { isAvailable: true, isVerified: true },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const activeCounts = await prisma.order.groupBy({
    by: ['deliveryPartnerId'],
    where: {
      deliveryPartnerId: { in: partners.map((partner) => partner.userId) },
      status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
    },
    _count: { _all: true },
  });
  const load = new Map(
    activeCounts.map((row) => [row.deliveryPartnerId, row._count._all]),
  );
  return partners
    .map((partner) => ({
      userId: partner.userId,
      name: partner.user.name,
      email: partner.user.email,
      vehicleType: partner.vehicleType,
      activeLoad: load.get(partner.userId) ?? 0,
      distanceKm:
        partner.currentLat !== null &&
        partner.currentLng !== null &&
        store
          ? Number(
              haversineKm(
                store.latitude,
                store.longitude,
                partner.currentLat,
                partner.currentLng,
              ).toFixed(2),
            )
          : null,
    }))
    .sort((a, b) => {
      if (a.activeLoad !== b.activeLoad) return a.activeLoad - b.activeLoad;
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    })
    .slice(0, 5);
}

async function createBatch(orderIds: string[]) {
  if (orderIds.length !== 2) {
    throw new AppError('A batch holds exactly two orders', 422, 'INVALID_BATCH');
  }
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, batchId: null },
  });
  if (orders.length !== 2) {
    throw new AppError('Both orders must be unbatched', 409, 'INVALID_BATCH');
  }
  return prisma.$transaction(async (tx) => {
    const batch = await tx.riderBatch.create({ data: {} });
    await tx.order.updateMany({
      where: { id: { in: orderIds } },
      data: { batchId: batch.id },
    });
    return tx.riderBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: { orders: { select: { id: true, orderNumber: true, status: true } } },
    });
  });
}

async function riderBatch(userId: string) {
  const order = await prisma.order.findFirst({
    where: { deliveryPartnerId: userId, batchId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { batchId: true },
  });
  if (!order?.batchId) return null;
  return prisma.riderBatch.findUnique({
    where: { id: order.batchId },
    include: {
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          address: {
            select: { line1: true, pincode: true, latitude: true, longitude: true },
          },
        },
      },
    },
  });
}

async function sendProofOtp(orderId: string, riderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { email: true, name: true } } },
  });
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  if (order.deliveryPartnerId !== riderId) {
    throw new AppError('This order is not assigned to you', 403, 'FORBIDDEN');
  }
  if (!['OUT_FOR_DELIVERY', 'ASSIGNED'].includes(order.status)) {
    throw new AppError('Order is not out for delivery', 409, 'INVALID_TRANSITION');
  }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  await prisma.proofOfDelivery.upsert({
    where: { orderId },
    create: { orderId, otpHash: hashOtp(code, orderId), otpSentAt: new Date() },
    update: {
      otpHash: hashOtp(code, orderId),
      otpSentAt: new Date(),
      attempts: 0,
      verifiedAt: null,
    },
  });
  await sendEmail({
    to: order.customer.email,
    subject: `Delivery code for ${order.orderNumber}`,
    text: `Your LocalMart delivery code is ${code}. Share it with the rider when your order arrives.`,
    html: `<p>Your LocalMart delivery code is <strong>${code}</strong>.</p><p>Share it with the rider when your order arrives.</p>`,
  });
  return { sent: true, ...(env.isProd ? {} : { devOtp: code }) };
}

async function verifyProof(
  orderId: string,
  riderId: string,
  otp: string,
  file?: Express.Multer.File,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  if (order.deliveryPartnerId !== riderId) {
    throw new AppError('This order is not assigned to you', 403, 'FORBIDDEN');
  }
  const proof = await prisma.proofOfDelivery.findUnique({ where: { orderId } });
  if (!proof) throw new AppError('Send the delivery code first', 409, 'POD_NOT_SENT');
  if (proof.verifiedAt) return { verified: true, photoUrl: proof.photoUrl };
  if (proof.attempts >= 5) {
    throw new AppError('Too many attempts. Send a new code.', 429, 'POD_LOCKED');
  }
  if (!verifyOtpHash(otp, orderId, proof.otpHash)) {
    await prisma.proofOfDelivery.update({
      where: { orderId },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('Incorrect delivery code', 400, 'POD_INVALID');
  }
  const photoUrl = file ? await saveProductImage(file) : undefined;
  await prisma.proofOfDelivery.update({
    where: { orderId },
    data: { verifiedAt: new Date(), photoUrl },
  });
  return { verified: true, photoUrl };
}

async function setWeather(input: {
  mode: WeatherMode;
  note?: string;
  surgeFee?: number;
}) {
  const store = await prisma.store.findFirst();
  if (!store) throw new AppError('Store is not configured', 500, 'STORE_NOT_CONFIGURED');
  return prisma.store.update({
    where: { id: store.id },
    data: {
      weatherMode: input.mode,
      weatherNote: input.note ?? null,
      surgeFee: input.surgeFee ?? 0,
      surgeFeeUpdatedAt: new Date(),
    },
  });
}

export const logisticsService = {
  weather,
  updateLocation,
  dispatchSuggestions,
  createBatch,
  riderBatch,
  sendProofOtp,
  verifyProof,
  setWeather,
};
