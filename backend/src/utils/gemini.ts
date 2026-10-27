import { env } from '../config/env';
import { logger } from './logger';

/**
 * Dependency-free Gemini client (generativelanguage.googleapis.com v1beta).
 *
 * Free-tier discipline:
 *  - token-bucket per call class (chat / embed / vision)
 *  - exponential backoff on 429 RESOURCE_EXHAUSTED
 *  - circuit breaker: 5 consecutive provider failures opens the circuit
 *    for CIRCUIT_COOLDOWN_MS — callers should fall back to heuristic mode
 *    while it is open (`isCallable()` reports availability).
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

const CHAT_RPM = 4;
const EMBED_RPM = 10;
const VISION_RPM = 3;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30_000;

type TokenBucket = {
  capacity: number;
  tokens: number;
  refillAt: number;
};

function createBucket(capacity: number): TokenBucket {
  return { capacity, tokens: capacity, refillAt: 0 };
}

const buckets = {
  chat: createBucket(CHAT_RPM),
  embed: createBucket(EMBED_RPM),
  vision: createBucket(VISION_RPM),
};

async function acquire(bucket: TokenBucket): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const now = Date.now();
    if (bucket.refillAt <= now) {
      bucket.tokens = bucket.capacity;
      bucket.refillAt = now + 60_000;
    }
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return;
    }
    await sleep(Math.min(5_000, bucket.refillAt - now + 50));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Circuit = {
  failures: number;
  openedAt: number | null;
};

const circuit: Circuit = { failures: 0, openedAt: null };

export function aiState(): {
  configured: boolean;
  circuitOpen: boolean;
  cooldownMsRemaining: number;
  failures: number;
} {
  const open =
    circuit.openedAt !== null &&
    Date.now() - circuit.openedAt < CIRCUIT_COOLDOWN_MS;
  const cooldownMsRemaining = open
    ? Math.max(0, CIRCUIT_COOLDOWN_MS - (Date.now() - (circuit.openedAt ?? 0)))
    : 0;
  return {
    configured: Boolean(env.GEMINI_API_KEY),
    circuitOpen: open,
    cooldownMsRemaining,
    failures: circuit.failures,
  };
}

function recordFailure(): void {
  circuit.failures += 1;
  if (circuit.failures >= CIRCUIT_THRESHOLD && circuit.openedAt === null) {
    circuit.openedAt = Date.now();
    logger.warn('AI circuit breaker opened', {
      failures: circuit.failures,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    });
  }
}

function recordSuccess(): void {
  circuit.failures = 0;
  circuit.openedAt = null;
}

export function isAiCallable(): boolean {
  if (!env.GEMINI_API_KEY) return false;
  const open =
    circuit.openedAt !== null &&
    Date.now() - circuit.openedAt < CIRCUIT_COOLDOWN_MS;
  return !open;
}

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type ChatOptions = {
  system?: string;
  images?: Array<{ mimeType: string; base64: string }>;
  /** When set, the response is returned as a parsed JSON object. */
  json?: true;
  temperature?: number;
};

export async function chat(prompt: string, options: ChatOptions = {}): Promise<string> {
  if (!isAiCallable()) throw new Error('AI_UNAVAILABLE');

  const parts: Part[] = [{ text: prompt }];
  for (const image of options.images ?? []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    ...(options.system
      ? {
          systemInstruction: {
            role: 'system',
            parts: [{ text: options.system }],
          },
        }
      : {}),
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: 2048,
      ...(options.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const text = await request('generateContent', body);
  return text;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!isAiCallable()) throw new Error('AI_UNAVAILABLE');
  if (texts.length === 0) return [];

  // The batch endpoint accepts up to 100 requests per call; chunk defensively.
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const chunk = texts.slice(i, i + 50);
    const body = {
      requests: chunk.map((text) => ({
        model: `models/${env.GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8_000) }] },
      })),
    };
    const json = await requestJson('batchEmbedContents', body);
    const embeddings = json?.embeddings as
      | Array<{ values: number[] }>
      | undefined;
    if (!embeddings) throw new Error('AI_BAD_RESPONSE');
    out.push(...embeddings.map((entry) => entry.values));
  }
  return out;
}

async function request(action: string, body: unknown): Promise<string> {
  const json = await requestJson(action, body);
  const candidate = (json?.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined)?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) throw new Error('AI_EMPTY_RESPONSE');
  return text;
}

type AiJson = { [key: string]: any };

async function requestJson(action: string, body: unknown): Promise<AiJson> {
  const bucket =
    action === 'batchEmbedContents'
      ? buckets.embed
      : action === 'generateContent' &&
          Array.isArray((body as { contents: Array<{ parts: Part[] }> }).contents?.[0]?.parts) &&
          (body as { contents: Array<{ parts: Part[] }> }).contents[0].parts.length > 1
        ? buckets.vision
        : buckets.chat;

  await acquire(bucket);

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${API_ROOT}/models/${action === 'batchEmbedContents' ? env.GEMINI_EMBEDDING_MODEL : env.GEMINI_MODEL}:${action}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': env.GEMINI_API_KEY,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        );
        if (response.status === 429) {
          recordFailure();
          if (attempt === MAX_RETRIES) {
            throw new Error('AI_RATE_LIMITED');
          }
          await sleep(5_000 * (attempt + 1));
          attempt += 1;
          continue;
        }
        if (response.status === 200) {
          recordSuccess();
          return (await response.json()) as AiJson;
        }
        if (response.status === 404) {
          // Model not on this tier — disable permanently for the process.
          circuit.failures = CIRCUIT_THRESHOLD;
          if (circuit.openedAt === null) circuit.openedAt = Date.now();
          throw new Error('AI_MODEL_UNAVAILABLE');
        }
        const text = await response.text().catch(() => '');
        if (response.status >= 500) {
          recordFailure();
          lastError = new Error(`AI_HTTP_${response.status}: ${text.slice(0, 200)}`);
          attempt += 1;
          await sleep(1_000);
          continue;
        }
        throw new Error(`AI_HTTP_${response.status}: ${text.slice(0, 200)}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        recordFailure();
        logger.warn('Gemini call failed', {
          action,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error instanceof Error ? error : new Error('AI_UNAVAILABLE');
      }
      attempt += 1;
      await sleep(1_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI_UNAVAILABLE');
}
