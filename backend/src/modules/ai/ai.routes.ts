import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { aiService, aiAdminService } from './ai.service';

export const aiRoutes = Router();

const chatSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  sessionId: z.string().uuid().optional(),
});

const searchSchema = z.object({
  query: z.string().trim().min(2).max(300),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

const supportSchema = z.object({
  message: z.string().trim().min(2).max(1000),
});

const visionSchema = z.object({
  image: z.string().min(50),
  mimeType: z.string().max(60).default('image/jpeg'),
});

const substitutesSchema = z.object({
  productId: z.string().uuid(),
});

const productCards = (rows: Array<{ product: unknown }>) =>
  rows.map((row) => row.product);

const chatHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const { message, sessionId } = req.body as z.infer<typeof chatSchema>;
    const result = await aiService.chat(req.user.id, message, sessionId);
    sendSuccess(res, result, 'Assistant reply');
  } catch (error) {
    next(error);
  }
};

const chatSessionsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const sessions = await aiService.chatSessions(req.user.id);
    sendSuccess(res, sessions, 'Chat history');
  } catch (error) {
    next(error);
  }
};

const searchHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const { query, limit } = req.body as z.infer<typeof searchSchema>;
    const results = await aiService.search(query, limit);
    sendSuccess(
      res,
      {
        results: productCards(results.map((row) => ({ product: row.product }))) as unknown[],
      },
      'Smart search results',
    );
  } catch (error) {
    next(error);
  }
};

const supportHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const { message } = req.body as z.infer<typeof supportSchema>;
    const result = await aiService.supportChat(req.user.id, message);    sendSuccess(res, result, 'Support answer');
  } catch (error) {
    next(error);
  }
};

const visionHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('authenticate did not attach a user');
    const { image, mimeType } = req.body as z.infer<typeof visionSchema>;
    const result = await aiService.visionSearch(image, mimeType);
    const product = result.productId
      ? await prisma.product.findUnique({ where: { id: result.productId } })
      : null;
    sendSuccess(res, { ...result, product }, 'Vision match');
  } catch (error) {
    next(error);
  }
};

const substitutesHandler: RequestHandler = async (req, res, next) => {
  try {
    const { productId } = req.validatedQuery as unknown as z.infer<typeof substitutesSchema>;
    const result = await aiService.substitutes(productId);
    sendSuccess(res, result, 'Substitutes');
  } catch (error) {
    next(error);
  }
};

// ——— admin ———

const adminAskSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

const summarizeSchema = z.object({
  notes: z.array(z.string().trim().min(2).max(1000)).min(1).max(30),
});

const adminAskHandler: RequestHandler = async (req, res, next) => {
  try {
    const { question } = req.body as z.infer<typeof adminAskSchema>;
    const result = await aiAdminService.ask(question);
    sendSuccess(res, result, 'AI answer');
  } catch (error) {
    next(error);
  }
};

const adminDraftHandler: RequestHandler = async (req, res, next) => {
  try {
    const { image, mimeType } = req.body as z.infer<typeof visionSchema>;
    const draft = await aiAdminService.draftFromPhoto(image, mimeType);
    sendSuccess(res, draft, 'Draft ready');
  } catch (error) {
    next(error);
  }
};

const adminSummarizeHandler: RequestHandler = async (req, res, next) => {
  try {
    const { notes } = req.body as z.infer<typeof summarizeSchema>;
    const result = await aiAdminService.summarize(notes);
    sendSuccess(res, result, 'Notes summarised');
  } catch (error) {
    next(error);
  }
};

const adminJobsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const jobs = await aiAdminService.recentJobs();
    sendSuccess(res, jobs, 'AI job log');
  } catch (error) {
    next(error);
  }
};

const backfillHandler: RequestHandler = async (_req, res, next) => {
  try {
    const result = await aiService.backfillEmbeddings();
    sendSuccess(res, result, result.skipped ? 'AI key missing — embeddings skipped' : 'Embeddings refreshed');
  } catch (error) {
    next(error);
  }
};

// ——— customer surface ———
aiRoutes.post('/chat', authenticate, authorize(Role.CUSTOMER), validateBody(chatSchema), chatHandler);
aiRoutes.get('/chat/sessions', authenticate, authorize(Role.CUSTOMER), chatSessionsHandler);
aiRoutes.post('/search', authenticate, authorize(Role.CUSTOMER), validateBody(searchSchema), searchHandler);
aiRoutes.post('/support', authenticate, authorize(Role.CUSTOMER), validateBody(supportSchema), supportHandler);
aiRoutes.post('/vision-search', authenticate, authorize(Role.CUSTOMER), validateBody(visionSchema), visionHandler);
aiRoutes.get(
  '/substitutes',
  authenticate,
  authorize(Role.CUSTOMER),
  validateQuery(substitutesSchema),
  substitutesHandler,
);

// ——— admin surface ———
aiRoutes.post('/admin/ask', authenticate, authorize(Role.ADMIN), validateBody(adminAskSchema), adminAskHandler);
aiRoutes.post('/admin/catalog-draft', authenticate, authorize(Role.ADMIN), validateBody(visionSchema), adminDraftHandler);
aiRoutes.post('/admin/summarize', authenticate, authorize(Role.ADMIN), validateBody(summarizeSchema), adminSummarizeHandler);
aiRoutes.get('/admin/jobs', authenticate, authorize(Role.ADMIN), adminJobsHandler);
aiRoutes.post('/admin/embeddings-backfill', authenticate, authorize(Role.ADMIN), backfillHandler);

export {};
