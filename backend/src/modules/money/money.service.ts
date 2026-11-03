import { Prisma, WalletTxnType, LoyaltyTier } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

/**
 * Money rails: wallet ledger, loyalty programme, referrals. Every mutation
 * runs inside the caller's transaction when provided so order placement stays
 * atomic (wallet redemption, refunds, loyalty earn).
 */

const TIER_THRESHOLDS: Array<{ tier: LoyaltyTier; from: number }> = [
  { tier: LoyaltyTier.GREEN, from: 0 },
  { tier: LoyaltyTier.SILVER, from: 5000 },
  { tier: LoyaltyTier.PRIME, from: 20000 },
];

export function tierForSpend(lifetimeSpend: number): LoyaltyTier {
  let tier: LoyaltyTier = LoyaltyTier.GREEN;
  for (const entry of TIER_THRESHOLDS) {
    if (lifetimeSpend >= entry.from) tier = entry.tier;
  }
  return tier;
}

export const TIER_PERKS: Record<LoyaltyTier, string> = {
  GREEN: 'Standard free-delivery at ₹500',
  SILVER: 'Free delivery at ₹350 + priority slots',
  PRIME: 'Free delivery + early access to flash deals',
};

export type MoneyClient = Prisma.TransactionClient | typeof prisma;

export async function ensureWallet(tx: MoneyClient, userId: string) {
  return tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function ensureLoyalty(tx: MoneyClient, userId: string) {
  return tx.loyaltyAccount.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function ensureReferral(tx: MoneyClient, userId: string) {
  return tx.referralCode.upsert({
    where: { userId },
    update: {},
    create: { userId, code: makeReferralCode(userId) },
  });
}

function makeReferralCode(userId: string): string {
  // Referral style: first 5 of name aren't reliable here; use base32 of uuid.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (const char of userId.replace(/-/g, '')) {
    code += alphabet[parseInt(char, 16) % alphabet.length];
    if (code.length === 7) break;
  }
  return code;
}

async function creditWallet(
  tx: MoneyClient,
  userId: string,
  amount: Prisma.Decimal | number,
  type: WalletTxnType,
  note: string,
  orderId?: string,
): Promise<void> {
  await ensureWallet(tx, userId);
  await tx.wallet.update({
    where: { userId },
    data: { balance: { increment: new Prisma.Decimal(amount) } },
  });
  await tx.walletTransaction.create({
    data: {
      userId,
      orderId: orderId ?? null,
      type,
      amount: new Prisma.Decimal(amount),
      note: note.slice(0, 200),
    },
  });
}

async function debitWallet(
  tx: MoneyClient,
  userId: string,
  amount: Prisma.Decimal,
  orderId: string,
): Promise<void> {
  const updated = await tx.wallet.updateMany({
    where: { userId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (updated.count !== 1) {
    throw new AppError('Wallet balance changed while paying', 409, 'WALLET_CHANGED');
  }
  await tx.walletTransaction.create({
    data: {
      userId,
      orderId,
      type: WalletTxnType.REDEEM,
      amount: amount.negated(),
      note: 'Wallet redemption at checkout',
    },
  });
}

/** Redeem wallet balance against an order total (capped at the amount due). */
export async function applyWalletRedemption(
  tx: MoneyClient,
  userId: string,
  orderId: string,
  amountDue: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  const wallet = await ensureWallet(tx, userId);
  const redeem = Prisma.Decimal.min(wallet.balance, amountDue);
  if (redeem.lessThan(1)) {
    return new Prisma.Decimal(0);
  }
  await debitWallet(tx, userId, redeem, orderId);
  return redeem;
}

/** Redeem loyalty points as rupees, capped at a share of the subtotal. */
export async function applyLoyaltyRedemption(
  tx: MoneyClient,
  userId: string,
  orderId: string,
  subtotal: Prisma.Decimal,
): Promise<{ points: number; amount: Prisma.Decimal }> {
  const account = await ensureLoyalty(tx, userId);
  const maxAmount = subtotal.mul(env.LOYALTY_MAX_REDEEM_PCT / 100);
  const maxPoints = Math.floor(maxAmount.div(env.LOYALTY_POINT_VALUE).toNumber());
  const points = Math.min(account.points, maxPoints);
  if (points < 1) return { points: 0, amount: new Prisma.Decimal(0) };
  const amount = new Prisma.Decimal(points).mul(env.LOYALTY_POINT_VALUE);
  const updated = await tx.loyaltyAccount.updateMany({
    where: { userId, points: { gte: points } },
    data: { points: { decrement: points } },
  });
  if (updated.count !== 1) {
    throw new AppError('Loyalty balance changed while paying', 409, 'LOYALTY_CHANGED');
  }
  await tx.walletTransaction.create({
    data: {
      userId,
      orderId,
      type: WalletTxnType.REDEEM,
      amount: amount.negated(),
      note: `Loyalty: ${points} points redeemed`,
    },
  });
  return { points, amount };
}

/** Earn loyalty points + tier on a delivered order. */
export async function earnLoyaltyOnDelivery(
  tx: MoneyClient,
  userId: string,
  orderId: string,
  total: Prisma.Decimal | number,
): Promise<void> {
  const account = await ensureLoyalty(tx, userId);
  const points = Math.floor(Number(total) * env.LOYALTY_EARN_RATE);
  if (points < 1) return;
  const updated = await tx.loyaltyAccount.update({
    where: { userId },
    data: {
      points: { increment: points },
      lifetimeSpend: { increment: new Prisma.Decimal(total) },
      tier: tierForSpend(Number(account.lifetimeSpend) + Number(total)),
    },
  });
  await tx.walletTransaction.create({
    data: {
      userId,
      orderId,
      type: WalletTxnType.GIFT,
      amount: new Prisma.Decimal(0),
      note: `Earned ${updated.points} loyalty points — tier ${updated.tier}`,
    },
  });
}

/** Refund wallet + loyalty resources when an order is cancelled. */
export async function refundOrderResources(
  tx: MoneyClient,
  userId: string,
  orderId: string,
  walletApplied: Prisma.Decimal,
  loyaltyPointsUsed: number,
): Promise<void> {
  if (walletApplied.greaterThan(0)) {
    await creditWallet(
      tx,
      userId,
      walletApplied,
      WalletTxnType.REFUND,
      `Refund for cancelled order`,
      orderId,
    );
  }
  if (loyaltyPointsUsed > 0) {
    await tx.loyaltyAccount.upsert({
      where: { userId },
      update: { points: { increment: loyaltyPointsUsed } },
      create: { userId, points: loyaltyPointsUsed },
    });
  }
}

export const moneyService = {
  async wallet(userId: string) {
    const wallet = await ensureWallet(prisma, userId);
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      balance: Number(wallet.balance),
      transactions: transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: Number(txn.amount),
        note: txn.note,
        orderId: txn.orderId,
        createdAt: txn.createdAt,
      })),
    };
  },

  async loyalty(userId: string) {
    const account = await ensureLoyalty(prisma, userId);
    const tier = tierForSpend(Number(account.lifetimeSpend));
    const next = TIER_THRESHOLDS.find((entry) => entry.from > Number(account.lifetimeSpend));
    return {
      points: account.points,
      lifetimeSpend: Number(account.lifetimeSpend),
      tier,
      perks: TIER_PERKS[tier],
      nextTier: next
        ? { tier: next.tier, spendRemaining: next.from - Number(account.lifetimeSpend), perks: TIER_PERKS[next.tier] }
        : null,
      pointValue: env.LOYALTY_POINT_VALUE,
      earnRate: env.LOYALTY_EARN_RATE,
      maxRedeemPct: env.LOYALTY_MAX_REDEEM_PCT,
    };
  },

  async referral(userId: string) {
    const referral = await ensureReferral(prisma, userId);
    return {
      code: referral.code,
      referredCount: referral.referredCount,
      creditsEarned: Number(referral.creditsEarned),
      reward: env.REFERRAL_REWARD,
    };
  },

  /**
   * First-order referral: customer applies a friend's code; both wallets get
   * credited immediately. One redemption per customer, own code rejected.
   * When called inside an order transaction, reuse that transaction.
   */
  async applyReferral(userId: string, code: string, txInput?: MoneyClient) {
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(trimmed)) {
      throw new AppError('That referral code does not look right', 422, 'REFERRAL_INVALID');
    }
    const owner = await prisma.referralCode.findUnique({ where: { code: trimmed } });
    if (!owner) {
      throw new AppError(`Referral code ${trimmed} does not exist`, 404, 'REFERRAL_NOT_FOUND');
    }
    if (owner.userId === userId) {
      throw new AppError("You cannot use your own referral code", 422, 'REFERRAL_SELF');
    }
    const already = await prisma.walletTransaction.findFirst({
      where: { userId, type: WalletTxnType.REFERRAL, note: { startsWith: 'Referral credit' } },
    });
    if (already) {
      throw new AppError('You have already used a referral credit', 409, 'REFERRAL_ALREADY_USED');
    }

    const run = async (tx: MoneyClient) => {
      await creditWallet(tx, userId, env.REFERRAL_REWARD, WalletTxnType.REFERRAL, `Referral credit from code ${trimmed}`);
      await creditWallet(tx, owner.userId, env.REFERRAL_REWARD, WalletTxnType.REFERRAL, `Your code ${trimmed} was used by a friend`);
      const updated = await tx.referralCode.update({
        where: { code: trimmed },
        data: { referredCount: { increment: 1 }, creditsEarned: { increment: env.REFERRAL_REWARD } },
      });
      return updated;
    };
    const updated = txInput ? await run(txInput) : await prisma.$transaction(run);
    return {
      credited: env.REFERRAL_REWARD,
      referredCount: updated.referredCount,
    };
  },
};
