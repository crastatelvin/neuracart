import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';
const REDACTED = '[REDACTED]';
const LOG_DIR = path.resolve(process.cwd(), 'logs');

const REDACT_KEYS = new Set([
  'authorization',
  'password',
  'code',
  'codehash',
  'token',
  'tokenhash',
  'refreshtoken',
  'accesstoken',
  'apikey',
  'secret',
  'otp',
  'otpcode',
  'razorpaykeysecret',
  'razorpaywebhooksecret',
]);

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (error) {
  console.error('Could not create log directory', error);
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!local || !domain) return value;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}****${local[local.length - 1]}@${domain}`;
}

function redactValue(
  value: unknown,
  key = '',
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (depth > 6) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return key.toLowerCase() === 'email' ? maskEmail(value) : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(env.isDev ? { stack: value.stack } : {}),
    };
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (REDACT_KEYS.has(childKey.toLowerCase())) {
      result[childKey] = REDACTED;
    } else {
      result[childKey] = redactValue(childValue, childKey, seen, depth + 1);
    }
  }
  return result;
}

function safeMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  try {
    return ` ${JSON.stringify(redactValue(meta))}`;
  } catch {
    return ' {"meta":"[Unserializable]"}';
  }
}

function writeToFile(level: LogLevel, line: string): void {
  try {
    const date = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(path.join(LOG_DIR, `${date}.${level}.log`), `${line}\n`);
  } catch (error) {
    console.error('Could not write log file', error);
  }
}

function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (env.isProd && level === 'debug') return;
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[env.LOG_LEVEL]) return;

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${safeMeta(meta)}`;
  writeToFile(level, line);

  const label = `[${timestamp}] [${level.toUpperCase()}]`;
  const color = process.stdout.isTTY ? COLORS[level] : '';
  const output = process.stdout.isTTY ? `${color}${label}${RESET} ${message}${safeMeta(meta)}` : line;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    log('error', message, meta),
  http: (message: string, meta?: Record<string, unknown>) =>
    log('info', message, meta),
};

export const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};
