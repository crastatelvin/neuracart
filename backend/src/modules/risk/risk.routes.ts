import { Router, type RequestHandler } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';

const listRisk: RequestHandler = async (_req, res, next) => {
  try {
    const flags = await prisma.riskFlag.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const byUser = new Map<
      string,
      {
        user: { id: string; name: string | null; email: string };
        score: number;
        kinds: Record<string, number>;
        lastAt: Date;
      }
    >();
    for (const flag of flags) {
      const entry = byUser.get(flag.userId) ?? {
        user: flag.user,
        score: 0,
        kinds: {},
        lastAt: flag.createdAt,
      };
      entry.score += flag.score;
      entry.kinds[flag.kind] = (entry.kinds[flag.kind] ?? 0) + 1;
      if (flag.createdAt > entry.lastAt) entry.lastAt = flag.createdAt;
      byUser.set(flag.userId, entry);
    }
    sendSuccess(
      res,
      [...byUser.values()].sort((a, b) => b.score - a.score),
      'Risk flags',
    );
  } catch (error) {
    next(error);
  }
};

export const adminRiskRoutes = Router();
adminRiskRoutes.get('/', listRisk);
