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
import { env } from '../src/config/env';

const prisma = new PrismaClient();
const DEV_PASSWORD = 'NeuraCart@123';
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
  ['Marcus Lindqvist', 'driver1@neuracart.app', 'BIKE', 'KA-01-AB-1001'],
  ['Diego Fernández', 'driver2@neuracart.app', 'SCOOTER', 'KA-01-AB-1002'],
  ["Liam O'Connor", 'driver3@neuracart.app', 'BIKE', 'KA-01-AB-1003'],
  ['Yuki Tanaka', 'driver4@neuracart.app', 'EV', 'KA-01-AB-1004'],
  ['Noah Bergström', 'driver5@neuracart.app', 'BIKE', 'KA-01-AB-1005'],
  ['Mateo Rossi', 'driver6@neuracart.app', 'SCOOTER', 'KA-01-AB-1006'],
  ['Kwame Mensah', 'driver7@neuracart.app', 'BIKE', 'KA-01-AB-1007'],
  ['Oliver Haas', 'driver8@neuracart.app', 'EV', 'KA-01-AB-1008'],
  ['Hugo Laurent', 'driver9@neuracart.app', 'BIKE', 'KA-01-AB-1009'],
  ['Ethan Brooks', 'driver10@neuracart.app', 'SCOOTER', 'KA-01-AB-1010'],
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
          <text x="400" y="540" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#ffffff">NeuraCart</text>
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

async function seedV2(input: {
  customer: { id: string };
  products: Map<string, { id: string; price: Prisma.Decimal }>;
}): Promise<void> {
  const { customer, products } = input;

  // ——— Per-user accounts ———
  await prisma.userPrefs.upsert({
    where: { userId: customer.id },
    create: {
      userId: customer.id,
      dietTags: ['VEGETARIAN', 'HOUSEHOLD_2'],
      language: 'en',
    },
    update: {},
  });
  const wallet = await prisma.wallet.upsert({
    where: { userId: customer.id },
    create: { userId: customer.id, balance: new Prisma.Decimal(150) },
    update: {},
  });
  const walletTxns = await prisma.walletTransaction.count({
    where: { userId: customer.id },
  });
  if (walletTxns === 0) {
    await prisma.walletTransaction.create({
      data: {
        userId: customer.id,
        type: 'GIFT',
        amount: new Prisma.Decimal(150),
        note: 'Welcome credit — thanks for joining NeuraCart!',
      },
    });
  }
  await prisma.loyaltyAccount.upsert({
    where: { userId: customer.id },
    create: { userId: customer.id, points: 120, lifetimeSpend: new Prisma.Decimal(2190) },
    update: {},
  });
  await prisma.referralCode.upsert({
    where: { userId: customer.id },
    create: { userId: customer.id, code: 'SUJAN50' },
    update: {},
  });

  // ——— Recipes ———
  const RECIPES: Array<{
    slug: string;
    title: string;
    description: string;
    servings: number;
    steps: string[];
    ingredients: Array<[string, number]>;
  }> = [
    {
      slug: 'tomato-onion-egg-bhurji',
      title: 'Masala Egg Bhurji',
      description: 'A 15-minute three-ingredient breakfast that always lands.',
      servings: 2,
      steps: [
        'Chop onions, tomatoes and capsicum.',
        'Sizzle with masala, crack in eggs, scramble.',
        'Finish with coriander and serve hot.',
      ],
      ingredients: [
        ['Eggs (Brown)', 1],
        ['Onions', 1],
        ['Tomatoes (Hybrid)', 1],
        ['Capsicum (Green)', 1],
      ],
    },
    {
      slug: 'weeknight-salad-bowl',
      title: 'Crunchy Weeknight Salad',
      description: 'Everything you need for a fresh, filling salad night.',
      servings: 2,
      steps: [
        'Chop capsicum, carrots, tomato.',
        'Toss with pomegranate for sweetness.',
        'Dress with lemon, oil and salt.',
      ],
      ingredients: [
        ['Capsicum (Green)', 1],
        ['Carrots', 1],
        ['Tomatoes (Hybrid)', 1],
        ['Pomegranate', 1],
        ['Grapes (Green)', 1],
      ],
    },
    {
      slug: 'rohu-fish-curry',
      title: 'Sunday Rohu Curry',
      description: 'A Bengali-style gravy recipe for the family table.',
      servings: 4,
      steps: [
        'Marinate fish with salt and turmeric; fry lightly.',
        'Build the onion-ginger gravy for ten minutes.',
        'Simmer fish in the gravy; rest before serving.',
      ],
      ingredients: [
        ['Fish (Rohu)', 1],
        ['Onions', 2],
        ['Tomatoes (Hybrid)', 1],
      ],
    },
    {
      slug: 'fruit-bowl-breakfast',
      title: 'Monsoon Fruit Bowl',
      description: 'Zero-cook breakfast bowl that clears the fruit tray.',
      servings: 2,
      steps: [
        'Cube apples, mangoes, bananas and grapes.',
        'Toss with lemon juice to keep it fresh.',
        'Top with pomegranate pearls.',
      ],
      ingredients: [
        ['Apples (Shimla)', 1],
        ['Mangoes (Alphonso)', 1],
        ['Bananas (Robusta)', 1],
        ['Grapes (Green)', 1],
        ['Pomegranate', 1],
      ],
    },
  ];

  for (const recipe of RECIPES) {
    const saved = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      create: {
        slug: recipe.slug,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        steps: recipe.steps,
        isPublished: true,
      },
      update: {
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        steps: recipe.steps,
      },
    });
    for (const [productName, quantity] of recipe.ingredients) {
      const product = products.get(productName);
      if (!product) continue;
      await prisma.recipeItem.upsert({
        where: { recipeId_productId: { recipeId: saved.id, productId: product.id } },
        create: { recipeId: saved.id, productId: product.id, quantity },
        update: { quantity },
      });
    }
  }

  // ——— Help articles ———
  const ARTICLES: Array<{ slug: string; title: string; body: string; topics: string[] }> = [
    {
      slug: 'delivery-charges',
      title: 'How are delivery charges calculated?',
      body: 'Delivery costs ₹40 per order and is free on orders of ₹500 or more. During heavy rain, a small surge fee may apply and is always shown before you place the order.',
      topics: ['delivery', 'fees'],
    },
    {
      slug: 'cancel-order',
      title: 'How do I cancel my order?',
      body: 'Open the order in your orders list and use Cancel while the status is Pending or Confirmed. Once the store starts preparing, only the store can cancel, and support is happy to help.',
      topics: ['orders', 'cancellation'],
    },
    {
      slug: 'upi-payments',
      title: 'How do UPI payments work?',
      body: 'Choose UPI at checkout and approve the payment request in GPay, PhonePe or any UPI app. If your payment app shows a different amount, ignore the request and contact us. COD stays available.',
      topics: ['payments', 'upi'],
    },
    {
      slug: 'delivery-slots',
      title: 'Can I schedule a delivery?',
      body: 'Yes. At checkout pick a delivery slot such as 8–10 AM or 6–8 PM. Slots are optional; choosing one reserves a rider window so your groceries arrive when you want.',
      topics: ['delivery', 'slots'],
    },
    {
      slug: 'wallet-refunds',
      title: 'What happens to refunds?',
      body: 'Cancellations of prepaid orders are credited instantly to your NeuraCart wallet, which applies automatically at your next checkout. COD refunds are settled by the store.',
      topics: ['payments', 'refund', 'wallet'],
    },
    {
      slug: 'fresh-produce-quality',
      title: 'What if my produce is not fresh?',
      body: 'Report the item right after delivery from the order screen. Our local team reviews every case and typically credits your wallet same day. We promise market-fresh or your money back.',
      topics: ['quality', 'refund', 'support'],
    },
    {
      slug: 'referrals',
      title: 'How does the referral program work?',
      body: 'Share your referral code from Profile → Referrals. Friends get ₹50 off their first order, and you get ₹50 wallet credit once their first order is delivered.',
      topics: ['referrals', 'rewards'],
    },
    {
      slug: 'order-tracking',
      title: 'Where is my order?',
      body: 'Open Orders and tap the active order to see the rider live on the map with an updated ETA. You get a push notification at confirmation, dispatch and delivery. If the dot stops moving for more than 10 minutes, message support from this screen.',
      topics: ['orders', 'tracking', 'delivery'],
    },
    {
      slug: 'scratch-contact',
      title: 'Still need help?',
      body: 'The support assistant on this page answers instantly from these articles. For anything it cannot solve, email support@neuracart.app and the store team will reply within a few hours.',
      topics: ['support'],
    },
  ];
  for (const article of ARTICLES) {
    await prisma.helpArticle.upsert({
      where: { slug: article.slug },
      create: article,
      update: { title: article.title, body: article.body, topics: article.topics },
    });
  }

  // ——— Product tags ———
  const TAGS: Record<string, string[]> = {
    'Bananas (Robusta)': ['VEGAN', 'BUDGET'],
    'Apples (Shimla)': ['EXOTIC'],
    'Mangoes (Alphonso)': ['EXOTIC', 'SEASONAL'],
    'Oranges (Nagpur)': ['SEASONAL'],
    'Grapes (Green)': [],
    Pomegranate: ['SEASONAL'],
    'Tomatoes (Hybrid)': ['STAPLE'],
    Onions: ['STAPLE', 'BUDGET'],
    Potatoes: ['STAPLE', 'BUDGET'],
    Spinach: ['LEAN'],
    Carrots: ['LEAN'],
    Broccoli: ['LEAN', 'EXOTIC'],
    'Capsicum (Green)': [],
    'Chicken Breast': ['LEAN', 'PROTEIN'],
    'Chicken Curry Cut': ['PROTEIN', 'FAMILY'],
    'Mutton Curry Cut': ['PROTEIN', 'FAMILY'],
    'Fish (Rohu)': ['PROTEIN', 'FAMILY'],
    'Prawns (Medium)': ['PROTEIN', 'EXOTIC'],
    'Eggs (Brown)': ['PROTEIN', 'VEGETARIAN'],
  };
  for (const [name, tags] of Object.entries(TAGS)) {
    const product = products.get(name);
    if (!product) continue;
    await prisma.product.update({ where: { id: product.id }, data: { tags } });
  }

  // ——— Delivery slots for the next 7 days ———
  const WINDOWS: Array<[string, string]> = [
    ['08:00', '10:00'],
    ['10:00', '12:00'],
    ['16:00', '18:00'],
    ['18:00', '20:00'],
  ];
  for (let day = 0; day < 7; day += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + day);
    for (const [startTime, endTime] of WINDOWS) {
      const windowLabel = `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`.replace('08:00', '8 AM').replace('10:00', '10 AM').replace('12:00', '12 PM').replace('16:00', '4 PM').replace('18:00', '6 PM').replace('20:00', '8 PM');
      const exists = await prisma.deliverySlot.findFirst({
        where: {
          date: { gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()), lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) },
          windowLabel,
        },
      });
      if (!exists) {
        await prisma.deliverySlot.create({
          data: {
            date,
            windowLabel,
            startTime,
            endTime,
            capacity: env.SLOT_CAPACITY_PER_WINDOW,
          },
        });
      }
    }
  }

  console.log(
    `v2 seed: wallet ₹${wallet.balance.toFixed(2)}, 4 recipes, ${ARTICLES.length} help articles, 7 days × ${WINDOWS.length} slots.`,
  );
}

async function main(): Promise<void> {  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_SEED !== 'true'
  ) {
    throw new Error('Refusing to seed production without ALLOW_SEED=true');
  }

  const riderPasswordHash = await hashPassword(DEV_PASSWORD);
  const admin = await upsertUser({
    email: 'admin@neuracart.app',
    name: 'Daniel Okafor',
    role: Role.ADMIN,
  });
  const customer = await upsertUser({
    email: 'customer@neuracart.app',
    name: 'Amelia Novak',
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
    where: { id: 'store_neuracart_central' },
    update: {
      name: 'NeuraCart Central',
      address: '14 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '+91 80 4000 1234',
      email: 'store@neuracart.app',
      openTime: '08:00',
      closeTime: '22:00',
      deliveryFee: new Prisma.Decimal(40),
      freeDeliveryAbove: new Prisma.Decimal(500),
      isOpen: true,
    },
    create: {
      id: 'store_neuracart_central',
      name: 'NeuraCart Central',
      address: '14 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '+91 80 4000 1234',
      email: 'store@neuracart.app',
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

  await seedV2({ customer, products });

  console.log('Seed complete.');
  console.log('Admin:    admin@neuracart.app');
  console.log('Customer: customer@neuracart.app');
  console.log('Rider:    driver1@neuracart.app / NeuraCart@123');
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
