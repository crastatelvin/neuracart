import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  ProductCategory,
  Role,
} from '@prisma/client';
import sharp from 'sharp';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();
const DEV_PASSWORD = 'LocalMart@123';
const IMAGE_DIR = path.resolve(__dirname, '../uploads/seed');

type ProductSeed = {
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  stock: number;
  featured: boolean;
};

const PRODUCTS: ProductSeed[] = [
  { name: 'Bananas (Robusta)', category: 'FRUITS', unit: '1 kg', price: 60, stock: 40, featured: true },
  { name: 'Apples (Shimla)', category: 'FRUITS', unit: '1 kg', price: 180, stock: 35, featured: true },
  { name: 'Mangoes (Alphonso)', category: 'FRUITS', unit: '1 kg', price: 250, stock: 25, featured: true },
  { name: 'Oranges (Nagpur)', category: 'FRUITS', unit: '1 kg', price: 90, stock: 30, featured: false },
  { name: 'Grapes (Green)', category: 'FRUITS', unit: '500 g', price: 70, stock: 30, featured: false },
  { name: 'Pomegranate', category: 'FRUITS', unit: '1 kg', price: 160, stock: 20, featured: false },
  { name: 'Tomatoes (Hybrid)', category: 'VEGETABLES', unit: '1 kg', price: 40, stock: 50, featured: true },
  { name: 'Onions', category: 'VEGETABLES', unit: '1 kg', price: 35, stock: 60, featured: false },
  { name: 'Potatoes', category: 'VEGETABLES', unit: '1 kg', price: 30, stock: 60, featured: false },
  { name: 'Spinach', category: 'VEGETABLES', unit: '250 g', price: 25, stock: 40, featured: false },
  { name: 'Carrots', category: 'VEGETABLES', unit: '500 g', price: 45, stock: 35, featured: false },
  { name: 'Broccoli', category: 'VEGETABLES', unit: '1 pc', price: 80, stock: 20, featured: false },
  { name: 'Capsicum (Green)', category: 'VEGETABLES', unit: '500 g', price: 40, stock: 30, featured: false },
  { name: 'Chicken Breast', category: 'MEAT', unit: '500 g', price: 220, stock: 15, featured: true },
  { name: 'Chicken Curry Cut', category: 'MEAT', unit: '1 kg', price: 280, stock: 15, featured: false },
  { name: 'Mutton Curry Cut', category: 'MEAT', unit: '500 g', price: 420, stock: 10, featured: false },
  { name: 'Fish (Rohu)', category: 'MEAT', unit: '1 kg', price: 260, stock: 10, featured: false },
  { name: 'Prawns (Medium)', category: 'MEAT', unit: '500 g', price: 350, stock: 8, featured: false },
  { name: 'Eggs (Brown)', category: 'MEAT', unit: '6 pcs', price: 60, stock: 30, featured: false },
];

const RIDERS = [
  ['Ravi Kumar', 'driver1@localmart.app', 'BIKE', 'KA-01-AB-1001'],
  ['Anand Raj', 'driver2@localmart.app', 'SCOOTER', 'KA-01-AB-1002'],
  ['Suresh Babu', 'driver3@localmart.app', 'BIKE', 'KA-01-AB-1003'],
  ['Imran Khan', 'driver4@localmart.app', 'EV', 'KA-01-AB-1004'],
  ['Vinay Gowda', 'driver5@localmart.app', 'BIKE', 'KA-01-AB-1005'],
  ['Deepak Shetty', 'driver6@localmart.app', 'SCOOTER', 'KA-01-AB-1006'],
  ['Manoj Naik', 'driver7@localmart.app', 'BIKE', 'KA-01-AB-1007'],
  ['Arjun Rao', 'driver8@localmart.app', 'EV', 'KA-01-AB-1008'],
  ['Karthik S', 'driver9@localmart.app', 'BIKE', 'KA-01-AB-1009'],
  ['Naveen Reddy', 'driver10@localmart.app', 'SCOOTER', 'KA-01-AB-1010'],
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function ensureProductImage(product: ProductSeed): Promise<string | null> {
  try {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    const slug = slugify(product.name);
    const filePath = path.join(IMAGE_DIR, `${slug}.webp`);
    if (!fs.existsSync(filePath)) {
      const colors: Record<ProductCategory, [string, string]> = {
        FRUITS: ['#f59e0b', '#fde68a'],
        VEGETABLES: ['#16a34a', '#bbf7d0'],
        MEAT: ['#be123c', '#fecdd3'],
      };
      const [dark, light] = colors[product.category];
      const label = escapeXml(product.name);
      const svg = `
        <svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="${dark}"/>
              <stop offset="1" stop-color="${light}"/>
            </linearGradient>
          </defs>
          <rect width="800" height="600" fill="url(#g)"/>
          <circle cx="650" cy="100" r="180" fill="rgba(255,255,255,0.16)"/>
          <circle cx="100" cy="520" r="140" fill="rgba(255,255,255,0.12)"/>
          <text x="400" y="310" text-anchor="middle" font-family="sans-serif" font-size="54" font-weight="700" fill="#ffffff">${label}</text>
          <text x="400" y="370" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#ffffff">${product.unit}</text>
          <text x="400" y="540" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#ffffff">LocalMart</text>
        </svg>
      `;
      await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(filePath);
    }
    return `/uploads/seed/${slug}.webp`;
  } catch (error) {
    console.warn(`Could not generate image for ${product.name}`, error);
    return null;
  }
}

async function upsertUser(input: {
  email: string;
  name: string;
  role: Role;
  password?: string;
  phone?: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      isActive: true,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.password ? { password: input.password } : {}),
    },
    create: {
      email: input.email,
      name: input.name,
      role: input.role,
      phone: input.phone ?? null,
      password: input.password ?? null,
      isActive: true,
    },
  });
}

async function ensureAddress(
  userId: string,
  label: string,
  data: Omit<Prisma.AddressUncheckedCreateInput, 'userId' | 'label'>,
) {
  const existing = await prisma.address.findFirst({ where: { userId, label } });
  if (existing) {
    return prisma.address.update({ where: { id: existing.id }, data });
  }
  return prisma.address.create({ data: { ...data, userId, label } });
}

async function createOrders(input: {
  customerId: string;
  adminId: string;
  addressId: string;
  riderUserId: string;
  products: Map<string, { id: string; price: Prisma.Decimal }>;
}) {
  const deliveredNumber = 'LM-20261021-0001';
  const deliveredExists = await prisma.order.findUnique({
    where: { orderNumber: deliveredNumber },
  });

  if (!deliveredExists) {
    const deliveredAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const createdAt = new Date(deliveredAt.getTime() - 45 * 60 * 1000);
    const bananas = input.products.get('Bananas (Robusta)');
    const spinach = input.products.get('Spinach');
    if (!bananas || !spinach) throw new Error('Seed products are missing');

    await prisma.order.create({
      data: {
        orderNumber: deliveredNumber,
        customerId: input.customerId,
        deliveryPartnerId: input.riderUserId,
        addressId: input.addressId,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.COD,
        subtotal: new Prisma.Decimal(205),
        deliveryFee: new Prisma.Decimal(40),
        total: new Prisma.Decimal(245),
        notes: 'Seed demo order',
        idempotencyKey: 'seed-delivered-order',
        createdAt,
        deliveredAt,
        items: {
          create: [
            {
              productId: bananas.id,
              quantity: 3,
              unitPrice: bananas.price,
              total: bananas.price.mul(3),
            },
            {
              productId: spinach.id,
              quantity: 1,
              unitPrice: spinach.price,
              total: spinach.price,
            },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, note: 'Order placed', changedBy: input.customerId },
            { status: OrderStatus.CONFIRMED, note: 'Confirmed by store', changedBy: input.adminId },
            { status: OrderStatus.PREPARING, note: 'Being packed', changedBy: input.adminId },
            { status: OrderStatus.ASSIGNED, note: 'Rider assigned', changedBy: input.adminId },
            { status: OrderStatus.OUT_FOR_DELIVERY, note: 'Rider picked up', changedBy: input.riderUserId },
            { status: OrderStatus.DELIVERED, note: 'Delivered', changedBy: input.riderUserId },
          ],
        },
        tracking: {
          create: {
            latitude: 12.9352,
            longitude: 77.6245,
            storeLatitude: 12.9716,
            storeLongitude: 77.5946,
            customerLatitude: 12.9352,
            customerLongitude: 77.6245,
          },
        },
      },
    });

    await prisma.deliveryPartner.update({
      where: { userId: input.riderUserId },
      data: {
        earnings: { increment: 40 },
        totalDeliveries: { increment: 1 },
      },
    });
  }

  const activeNumber = 'LM-20261022-0001';
  const activeExists = await prisma.order.findUnique({
    where: { orderNumber: activeNumber },
  });

  if (!activeExists) {
    const mangoes = input.products.get('Mangoes (Alphonso)');
    const apples = input.products.get('Apples (Shimla)');
    if (!mangoes || !apples) throw new Error('Seed products are missing');

    await prisma.order.create({
      data: {
        orderNumber: activeNumber,
        customerId: input.customerId,
        addressId: input.addressId,
        status: OrderStatus.PREPARING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        subtotal: new Prisma.Decimal(1040),
        deliveryFee: new Prisma.Decimal(0),
        total: new Prisma.Decimal(1040),
        notes: 'Seed active order — ready for admin assignment',
        idempotencyKey: 'seed-active-order',
        estimatedAt: new Date(Date.now() + 40 * 60 * 1000),
        items: {
          create: [
            {
              productId: mangoes.id,
              quantity: 2,
              unitPrice: mangoes.price,
              total: mangoes.price.mul(2),
            },
            {
              productId: apples.id,
              quantity: 3,
              unitPrice: apples.price,
              total: apples.price.mul(3),
            },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, note: 'Order placed', changedBy: input.customerId },
            { status: OrderStatus.CONFIRMED, note: 'Confirmed by store', changedBy: input.adminId },
            { status: OrderStatus.PREPARING, note: 'Being packed', changedBy: input.adminId },
          ],
        },
        tracking: {
          create: {
            storeLatitude: 12.9716,
            storeLongitude: 77.5946,
            customerLatitude: 12.9352,
            customerLongitude: 77.6245,
          },
        },
      },
    });
  }
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_SEED !== 'true'
  ) {
    throw new Error('Refusing to seed production without ALLOW_SEED=true');
  }

  const riderPasswordHash = await hashPassword(DEV_PASSWORD);
  const admin = await upsertUser({
    email: 'admin@localmart.app',
    name: 'Asha Rao',
    role: Role.ADMIN,
  });
  const customer = await upsertUser({
    email: 'customer@localmart.app',
    name: 'Sujan Anand',
    role: Role.CUSTOMER,
    phone: '+91 98765 43210',
  });

  const riders: { userId: string; name: string }[] = [];
  for (const [name, email, vehicleType, vehicleNumber] of RIDERS) {
    const user = await upsertUser({
      email,
      name,
      role: Role.DELIVERY_PARTNER,
      password: riderPasswordHash,
    });
    await prisma.deliveryPartner.upsert({
      where: { userId: user.id },
      update: {
        vehicleType,
        vehicleNumber,
        isAvailable: true,
        isVerified: true,
      },
      create: {
        userId: user.id,
        vehicleType,
        vehicleNumber,
        isAvailable: true,
        isVerified: true,
      },
    });
    riders.push({ userId: user.id, name });
  }

  await prisma.store.upsert({
    where: { id: 'store_localmart_central' },
    update: {
      name: 'LocalMart Central',
      address: '14 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '+91 80 4000 1234',
      email: 'store@localmart.app',
      openTime: '08:00',
      closeTime: '22:00',
      deliveryFee: new Prisma.Decimal(40),
      freeDeliveryAbove: new Prisma.Decimal(500),
      isOpen: true,
    },
    create: {
      id: 'store_localmart_central',
      name: 'LocalMart Central',
      address: '14 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '+91 80 4000 1234',
      email: 'store@localmart.app',
      openTime: '08:00',
      closeTime: '22:00',
      deliveryFee: new Prisma.Decimal(40),
      freeDeliveryAbove: new Prisma.Decimal(500),
      isOpen: true,
    },
  });

  await prisma.address.updateMany({
    where: { userId: customer.id },
    data: { isDefault: false },
  });
  const home = await ensureAddress(customer.id, 'Home', {
    line1: '12, 4th Cross, Martini Layout',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560040',
    latitude: 12.9352,
    longitude: 77.6245,
    isDefault: true,
  });
  await ensureAddress(customer.id, 'Work', {
    line1: 'WeWork, 10th Floor, 80 Feet Road, Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560095',
    latitude: 12.9352,
    longitude: 77.6245,
    isDefault: false,
  });

  const products = new Map<string, { id: string; price: Prisma.Decimal }>();
  for (const product of PRODUCTS) {
    const imageUrl = await ensureProductImage(product);
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });
    const data = {
      description: `${product.name} — fresh from the neighbourhood market.`,
      category: product.category,
      price: new Prisma.Decimal(product.price),
      unit: product.unit,
      stock: product.stock,
      imageUrl,
      isActive: true,
      isFeatured: product.featured,
    };
    const saved = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data: { ...data, name: product.name } });
    products.set(product.name, {
      id: saved.id,
      price: saved.price,
    });
  }

  await createOrders({
    customerId: customer.id,
    adminId: admin.id,
    addressId: home.id,
    riderUserId: riders[0].userId,
    products,
  });

  console.log('Seed complete.');
  console.log('Admin:    admin@localmart.app');
  console.log('Customer: customer@localmart.app');
  console.log('Rider:    driver1@localmart.app / LocalMart@123');
  console.log('Products: 19');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
