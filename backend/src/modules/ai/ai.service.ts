import { Prisma, type Product } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { chat as geminiChat, embed as geminiEmbed, isAiCallable } from '../../utils/gemini';

/**
 * The AI suite. Every capability degrades to a deterministic fallback when
 * GEMINI_API_KEY is absent or the circuit breaker is open — behaviour is
 * identical to dev OTP: fully functional, just lower quality.
 */

const CATALOG_CONTEXT_LIMIT = 40;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'buy', 'can', 'cheap', 'do', 'for',
  'fresh', 'from', 'get', 'give', 'good', 'have', 'hello', 'help', 'hi', 'i',
  'in', 'is', 'it', 'lack', 'like', 'me', 'much', 'my', 'need', 'of', 'on',
  'some', 'that', 'the', 'their', 'there', 'they', 'this', 'to', 'under',
  'want', 'what', 'will', 'with', 'you', 'your', 'rupees', 'rs',
]);

type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  tags: string[];
};

async function loadCatalog(): Promise<CatalogEntry[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: CATALOG_CONTEXT_LIMIT,
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price.toFixed(2),
    unit: product.unit,
    tags: product.tags,
  }));
}

function catalogueForPrompt(entries: CatalogEntry[]): string {
  return entries
    .map((entry) => `${entry.id.slice(0, 8)} • ${entry.name} • ₹${entry.price}/${entry.unit} • ${entry.category.toLowerCase()}`)
    .join('\n');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

async function logJob(
  feature: string,
  status: 'ok' | 'fallback' | 'error',
  model: string | null,
  latencyMs: number,
  detail?: string,
): Promise<void> {
  await prisma.aIJobLog.create({
    data: { feature, status, model, latencyMs: Math.round(latencyMs), detail: detail?.slice(0, 300) },
  }).catch(() => undefined);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    // Tolerate prose around the JSON payload.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

/** Fallback cart proposal: keyword overlap against names/tags/categories. */
function fallbackCart(message: string, catalog: CatalogEntry[]): {
  reply: string;
  cartItems: Array<{ productId: string; quantity: number }>;
  usedFallback: true;
} {
  const tokens = tokenize(message);
  const scored = catalog
    .map((entry) => {
      const haystack = `${entry.name} ${entry.tags.join(' ')} ${entry.category}`.toLowerCase();
      const score = tokens.reduce(
        (sum, token) => sum + (haystack.includes(token) ? (entry.name.toLowerCase().includes(token) ? 2 : 1) : 0),
        0,
      );
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) {
    return {
      reply:
        'I could not match that to the shelves just now — I run in offline mode without the AI key, so try a keyword like "tomato", "eggs" or "chicken", or browse the Fresh picks on your home screen.',
      cartItems: [],
      usedFallback: true,
    };
  }
  const names = scored.map((item) => `${item.entry.name} (₹${item.entry.price})`).join(', ');
  return {
    reply: `In offline mode I matched your ask to: ${names}. Tap Add cart below or browse each item.`,
    cartItems: scored.map((item) => ({ productId: item.entry.id, quantity: 1 })),
    usedFallback: true,
  };
}

export const aiService = {
  // ————————————————————————— shopping chat —————————————————————————

  async chat(
    userId: string,
    message: string,
    sessionId?: string,
  ): Promise<{
    sessionId: string;
    reply: string;
    cartItems: Array<{ productId: string; quantity: number }>;
    model: string | null;
    usedFallback: boolean;
  }> {
    const session = sessionId
      ? await prisma.chatSession.findFirst({
          where: { id: sessionId, userId, kind: 'SHOPPING' },
        })
      : null;
    const activeSession =
      session ??
      (await prisma.chatSession.create({
        data: { userId, kind: 'SHOPPING', title: message.slice(0, 60) },
      }));

    await prisma.chatMessage.create({
      data: { sessionId: activeSession.id, role: 'USER', content: message.slice(0, 2000) },
    });

    const catalog = await loadCatalog();
    const started = Date.now();
    let reply: string;
    let cartItems: Array<{ productId: string; quantity: number }> = [];
    let model: string | null = null;

    if (isAiCallable()) {
      const prompt = [
        'You are the NeuraCart shopping assistant, a friendly neighbourhood grocer chat.',
        'Genuine Indian grocery context. Prices are INR. Keep replies under 60 words.',
        'Only recommend products from this catalog — never invent products:',
        catalogueForPrompt(catalog),
        '',
        'Reply with ONLY a JSON object:',
        '{"reply": string, "cartItems": [{"productId": string, "quantity": number}]}',
        'cartItems holds the products the customer should add (use the product ids from the catalog, max 6 items).',
        'If the ask matches nothing, reply helpfully with an empty cartItems.',
        '',
        `Customer: ${message}`,
      ].join('\n');
      try {
        const text = await geminiChat(prompt, { json: true, temperature: 0.4 });
        const parsed = parseJsonObject(text);
        if (!parsed) throw new Error('AI_BAD_JSON');
        reply = typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim()
          : 'Here is what I found for you.';
        const rawItems = Array.isArray(parsed.cartItems) ? parsed.cartItems : [];
        const validIds = new Set(catalog.map((entry) => entry.id));
        cartItems = rawItems
          .filter((item): item is { productId?: unknown; quantity?: unknown } =>
            typeof item === 'object' && item !== null)
          .map((item) => ({
            productId: typeof item.productId === 'string' && validIds.has(item.productId)
              ? item.productId
              : catalog.find((entry) => entry.id.startsWith(String(item.productId ?? '').slice(0, 8)))?.id ?? '',
            quantity: Math.min(10, Math.max(1, Number(item.quantity) || 1)),
          }))
          .filter((item) => item.productId);
        model = env.GEMINI_MODEL;
        await logJob('chat', 'ok', model, Date.now() - started);
      } catch (error) {
        const failed = fallbackCart(message, catalog);
        reply = failed.reply;
        cartItems = failed.cartItems;
        await logJob('chat', 'fallback', null, Date.now() - started, error instanceof Error ? error.message : String(error));
      }
    } else {
      const failed = fallbackCart(message, catalog);
      reply = failed.reply;
      cartItems = failed.cartItems;
      await logJob('chat', 'fallback', null, Date.now() - started);
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: activeSession.id,
        role: 'ASSISTANT',
        content: reply,
        cartProposal: cartItems.length
          ? { items: cartItems }
          : Prisma.JsonNull,
        model,
      },
    });

    return {
      sessionId: activeSession.id,
      reply,
      cartItems,
      model,
      usedFallback: model === null,
    };
  },

  async chatSessions(userId: string) {
    const sessions = await prisma.chatSession.findMany({
      where: { userId, kind: 'SHOPPING' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      messages: session.messages
        .filter((message) => message.role === 'ASSISTANT' || message.role === 'USER')
        .map((message) => ({
          id: message.id,
          role: message.role === 'USER' ? 'user' : 'assistant',
          content: message.content,
          cartProposal: (message.cartProposal as { items?: Array<{ productId: string; quantity: number }> } | null)?.items ?? [],
          model: message.model,
          createdAt: message.createdAt,
        })),
    }));
  },

  // ————————————————————————— hybrid search —————————————————————————

  async search(
    query: string,
    limit = 12,
  ): Promise<Array<{ product: Product; score: number; semantic: boolean }>> {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: 200,
    });

    // Lexical score on every candidate (always available).
    const lexical = new Map<string, number>();
    for (const product of products) {
      const haystack = `${product.name} ${product.tags.join(' ')} ${product.category} ${product.description ?? ''}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (product.name.toLowerCase().includes(token)) score += 3;
        else if (haystack.includes(token)) score += 1.5;
      }
      if (score > 0) lexical.set(product.id, score);
    }

    // Semantic score on top: embed the query, compare with cached vectors.
    let queryVector: number[] | null = null;
    if (isAiCallable() && products.length > 0) {
      try {
        const started = Date.now();
        [queryVector] = await geminiEmbed([query.slice(0, 500)]);
        await logJob('search.embed', 'ok', env.GEMINI_EMBEDDING_MODEL, Date.now() - started);
      } catch {
        queryVector = null;
      }
    }

    const cosine = (a: number[], b: number[]): number => {
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
    };

    const results: Array<{ product: Product; score: number; semantic: boolean }> = [];
    for (const product of products) {
      const lexicalScore = lexical.get(product.id) ?? 0;
      let semanticScore = 0;
      const cached = product.embedding as number[] | null;
      if (queryVector && Array.isArray(cached) && cached.length > 0) {
        semanticScore = Math.max(0, cosine(queryVector, cached)) * 10;
      }
      const score = lexicalScore + semanticScore;
      if (score > 0) {
        results.push({ product, score, semantic: semanticScore > lexicalScore });
      }
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  /** Compute and cache embeddings for products with none (nightly/admin button path). */
  async backfillEmbeddings(limit = 100): Promise<{ updated: number; skipped: boolean }> {
    if (!isAiCallable()) return { updated: 0, skipped: true };
    const products = await prisma.product.findMany({
      where: { isActive: true, embedding: { equals: Prisma.AnyNull } },
      take: limit,
    });
    if (products.length === 0) return { updated: 0, skipped: false };
    const texts = products.map((product) =>
      `${product.name}. ${product.category.toLowerCase()} grocery. Tags: ${product.tags.join(', ') || 'none'}. ${product.description ?? ''}`.slice(0, 1000),
    );
    const vectors = await geminiEmbed(texts);
    await prisma.$transaction(
      products.map((product, index) =>
        prisma.product.update({
          where: { id: product.id },
          data: {
            embedding: vectors[index],
            embeddingModel: env.GEMINI_EMBEDDING_MODEL,
            embeddingAt: new Date(),
          },
        }),
      ),
    );
    return { updated: products.length, skipped: false };
  },

  // ————————————————————————— vision —————————————————————————

  async visionSearch(
    imageBase64: string,
    mimeType: string,
  ): Promise<{ productId: string | null; name: string | null; usedFallback: boolean }> {
    if (!isAiCallable()) {
      throw new AppError(
        'Vision search needs the AI key. Keyword search works great meanwhile.',
        503,
        'AI_UNAVAILABLE',
      );
    }
    const catalog = await loadCatalog();
    const started = Date.now();
    const text = await geminiChat(
      [
        'Identify the grocery item in this photo (Indian market context).',
        'Match it to this catalog and reply with ONLY JSON:',
        '{"name": string, "productId": string | null}',
        'Catalog:',
        catalogueForPrompt(catalog),
      ].join('\n'),
      {
        images: [{ mimeType: mimeType || 'image/jpeg', base64: imageBase64 }],
        json: true,
        temperature: 0.2,
      },
    );
    await logJob('vision', 'ok', env.GEMINI_MODEL, Date.now() - started);
    const parsed = parseJsonObject(text);
    const name = typeof parsed?.name === 'string' ? parsed.name : null;
    let productId: string | null = null;
    if (typeof parsed?.productId === 'string' && catalog.some((entry) => entry.id === parsed.productId)) {
      productId = parsed.productId;
    } else if (name) {
      const tokens = tokenize(name);
      const best = catalog
        .map((entry) => {
          const haystack = `${entry.name} ${entry.category}`.toLowerCase();
          return { entry, hits: tokens.filter((token) => haystack.includes(token)).length };
        })
        .sort((a, b) => b.hits - a.hits)[0];
      productId = best && best.hits > 0 ? best.entry.id : null;
    }
    return { productId, name, usedFallback: false };
  },

  // ————————————————————————— substitutes —————————————————————————

  async substitutes(productId: string): Promise<{
    items: Array<{ product: Product; reason: string }>;
    note: string | null;
    usedFallback: boolean;
  }> {
    const source = await prisma.product.findUnique({ where: { id: productId } });
    if (!source || !source.isActive) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    const alternatives = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: { gt: 0 },
        category: source.category,
        id: { not: source.id },
      },
      take: 6,
      orderBy: { isFeatured: 'desc' },
    });

    const sourcePrice = Number(source.price);
    const items = alternatives
      .map((product) => {
        const deltaPct = Math.round(((Number(product.price) - sourcePrice) / (sourcePrice || 1)) * 100);
        const reason =
          deltaPct <= -10
            ? `-about ${Math.abs(deltaPct)}% cheaper and ${product.unit}`
            : deltaPct >= 10
              ? `+premium pick, ${product.unit}`
              : `same-use swap, ${product.unit}`;
        return { product, reason };
      })
      .slice(0, 4);

    let note: string | null = null;
    let usedFallback = true;
    if (isAiCallable() && items.length > 0) {
      const started = Date.now();
      try {
        note = await geminiChat(
          `A customer looking at "${source.name}" (₹${sourcePrice}/${source.unit}) may need a substitute. Reply with ONE short sentence (max 18 words) covering the best swaps among: ${items.map((item) => item.product.name).join(', ')}. No preamble.`,
          { temperature: 0.3 },
        ).then((text) => text.trim());
        usedFallback = false;
        await logJob('substitutes', 'ok', env.GEMINI_MODEL, Date.now() - started);
      } catch (error) {
        note = null;
        await logJob('substitutes', 'fallback', null, Date.now() - started);
        logger.debug('Substitutes note fallback', { error: String(error) });
      }
    }
    return { items, note, usedFallback };
  },

  // ————————————————————————— support chat (help-article RAG) —————————————————————————

  async supportChat(
    _userId: string,
    message: string,
  ): Promise<{ reply: string; articleSlugs: string[]; usedFallback: boolean }> {
    const articles = await prisma.helpArticle.findMany({ where: { isPublished: true } });
    const tokens = tokenize(message);
    const ranked = articles
      .map((article) => {
        const haystack = `${article.title} ${article.topics.join(' ')} ${article.body}`.toLowerCase();
        return { article, score: tokens.filter((token) => haystack.includes(token)).length };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const started = Date.now();
    if (isAiCallable() && ranked.length > 0) {
      try {
        const context = ranked
          .map((item) => `--- ${item.article.title} (${item.article.slug})\n${item.article.body}`)
          .join('\n\n');
        const reply = await geminiChat(
          [
            'You are the NeuraCart support assistant. Answer the customer in 1–3 short sentences.',
            'Ground every claim on these help articles; do not invent policies. If the articles do not cover it, say support@neuracart.app will help.',
            '',
            context,
            '',
            `Customer question: ${message}`,
          ].join('\n'),
          { temperature: 0.3 },
        );
        await logJob('support', 'ok', env.GEMINI_MODEL, Date.now() - started);
        return {
          reply: reply.trim(),
          articleSlugs: ranked.map((item) => item.article.slug),
          usedFallback: false,
        };
      } catch {
        // fall through to retrieval answer
      }
    }

    const reply =
      ranked.length > 0
        ? `${ranked[0].article.body}\n\n(From “${ranked[0].article.title}” — ask support@neuracart.app for anything else.)`
        : 'I could not find a matching help article in offline mode. Email support@neuracart.app and the store team will sort it quickly.';
    await logJob('support', ranked.length > 0 && false ? 'ok' : 'fallback', null, Date.now() - started);
    return {
      reply,
      articleSlugs: ranked.map((item) => item.article.slug),
      usedFallback: true,
    };
  },
};

// ————————————————————————— admin NL-ops —————————————————————————

const FORBIDDEN_SQL = /\b(insert|update|delete|drop|alter|create|grant|truncate|copy|vacuum)\b/i;

export const aiAdminService = {
  /**
   * "Ask the data": text question → read-only SQL → answer. Without the AI
   * key, falls back to a canned operations dashboard answer.
   */
  async ask(question: string): Promise<{ answer: string; sql: string | null; rows: unknown[]; usedFallback: boolean }> {
    if (FORBIDDEN_SQL.test(question)) {
      throw new AppError('That question reads like a write operation', 422, 'AI_ASK_FORBIDDEN');
    }
    const started = Date.now();
    if (isAiCallable()) {
      const tables = ['users', 'orders', 'products', 'order_items', 'addresses', 'product_reviews', 'wallets', 'delivery_slots', 'subscriptions', 'flash_deals', 'rider_batches', 'risk_flags'];
      try {
        const text = await geminiChat(
          [
            'You translate business questions into ONE PostgreSQL SELECT query on a Postgres grocery-store schema.',
            `Tables (snake_case): ${tables.join(', ')}. orders has columns like "orderNumber", status(PENDING..DELIVERED,CANCELLED enum text), total numeric, "createdAt" timestamptz, "customerId" uuid, "deliveryPartnerId" uuid, "paymentMethod" text.`,
            'Rules: read-only single statement, never write, LIMIT 50 max, do not expose emails or phones beyond counts.',
            'Reply with ONLY JSON: {"sql": string, "answerHint": string}',
            '',
            `Question: ${question}`,
          ].join('\n'),
          { json: true, temperature: 0.1 },
        );
        const parsed = parseJsonObject(text);
        const sql = typeof parsed?.sql === 'string' ? parsed.sql.trim().replace(/;+\s*$/, '') : '';
        if (!sql || !/^select\b/i.test(sql) || FORBIDDEN_SQL.test(sql) || sql.includes(';')) {
          throw new Error('AI_UNSAFE_SQL');
        }
        const rows = await prisma.$queryRawUnsafe<unknown[]>(`${sql} LIMIT 50`);
        // Second pass: summarise the rows for humans.
        const summary = await geminiChat(
          `Business question: ${question}\nQuery: ${sql}\nRows (JSON): ${JSON.stringify(rows).slice(0, 4000)}\nAnswer the question in up to 3 short sentences for a store owner. No preamble.`,
          { temperature: 0.3 },
        );
        await logJob('admin.ask', 'ok', env.GEMINI_MODEL, Date.now() - started);
        return { answer: summary.trim(), sql, rows, usedFallback: false };
      } catch (error) {
        logger.warn('Admin AI ask failed, falling back', { error: String(error) });
      }
    }

    // Deterministic fallback: always-on operational snapshot.
    const [orders, customers, products, pending] = await Promise.all([
      prisma.order.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
    ]);
    await logJob('admin.ask', 'fallback', null, Date.now() - started);
    return {
      answer: `Offline mode snapshot: ${pending} pending of ${orders} lifetime orders, ${customers} customers, ${products} active products. Connect the AI key (GEMINI_API_KEY) for natural-language answers on specific questions.`,
      sql: null,
      rows: [],
      usedFallback: true,
    };
  },

  /** Product catalog draft from a photo. */
  async draftFromPhoto(imageBase64: string, mimeType: string): Promise<Record<string, unknown>> {
    if (!isAiCallable()) {
      throw new AppError(
        'AI draft needs the Gemini key. Fill the product form manually meanwhile.',
        503,
        'AI_UNAVAILABLE',
      );
    }
    const started = Date.now();
    const text = await geminiChat(
      [
        'Draft a grocery catalog card from this product photo (Indian market).',
        'Reply ONLY JSON: {"name": string, "category": "FRUITS" | "VEGETABLES" | "MEAT", "unit": string, "price": number, "description": string, "tags": string[]}',
        'price is a sensible INR retail estimate; description max 20 words; tags from VEGAN VEGETARIAN PROTEIN EXOTIC SEASONAL STAPLE BUDGET FAMILY LEAN.',
      ].join('\n'),
      { images: [{ mimeType: mimeType || 'image/jpeg', base64: imageBase64 }], json: true, temperature: 0.3 },
    );
    await logJob('admin.draft', 'ok', env.GEMINI_MODEL, Date.now() - started);
    const parsed = parseJsonObject(text);
    if (!parsed) throw new AppError('Could not read that image', 422, 'AI_BAD_DRAFT');
    if (parsed.category !== 'FRUITS' && parsed.category !== 'VEGETABLES' && parsed.category !== 'MEAT') {
      parsed.category = 'FRUITS';
    }
    if (Array.isArray(parsed.tags)) {
      parsed.tags = (parsed.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string').slice(0, 4);
    }
    if (typeof parsed.price !== 'number' || Number.isNaN(parsed.price)) parsed.price = 50;
    return parsed;
  },

  /** Summarise arbitrary store notes. */
  async summarize(notes: string[]): Promise<{ summary: string; usedFallback: boolean }> {
    if (notes.length === 0) {
      throw new AppError('Provide at least one note', 422, 'NOTES_REQUIRED');
    }
    const joined = notes.join('\n- ').slice(0, 4000);
    if (isAiCallable()) {
      const started = Date.now();
      try {
        const summary = await geminiChat(
          `Summarise these store notes into max 3 bullet-ish sentences for the owner. No preamble.\n- ${joined}`,
          { temperature: 0.3 },
        );
        await logJob('admin.summarize', 'ok', env.GEMINI_MODEL, Date.now() - started);
        return { summary: summary.trim(), usedFallback: false };
      } catch {
        // fall through
      }
    }
    const fallback = notes
      .slice(0, 5)
      .map((note) => note.split(/[.!]/)[0].trim())
      .filter(Boolean)
      .join('. ');
    return { summary: `Offline digest: ${fallback || 'no substantive notes'}.`, usedFallback: true };
  },

  async recentJobs(limit = 20) {
    return prisma.aIJobLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  },
};
