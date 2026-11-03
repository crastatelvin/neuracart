import type { Server } from 'node:http';
import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './utils/logger';

let server: Server | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');

  server = app.listen(env.PORT, () => {
    logger.info('NeuraCart API listening', {
      port: env.PORT,
      environment: env.NODE_ENV,
      health: `http://localhost:${env.PORT}/health`,
    });
  });

  server.on('error', (error) => {
    logger.error('HTTP server error', { error });
    void shutdown('SERVER_ERROR');
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down NeuraCart API', { signal });

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  }
  await prisma.$disconnect();
  clearTimeout(forceExit);
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  void shutdown('UNCAUGHT_EXCEPTION');
});

start().catch((error) => {
  logger.error('Failed to start NeuraCart API', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  void prisma.$disconnect().finally(() => process.exit(1));
});
