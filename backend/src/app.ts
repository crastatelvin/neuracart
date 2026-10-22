import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { errorHandler } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiter';
import { notFound } from './middleware/notFound';
import { requestId } from './middleware/requestId';
import { AppError } from './utils/errors';
import { morganStream } from './utils/logger';
import { sendSuccess } from './utils/response';

const app = express();

app.disable('x-powered-by');
if (env.isProd) {
  app.set('trust proxy', 1);
}

app.use(requestId);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || env.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new AppError('Origin not allowed by CORS', 403, 'CORS_FORBIDDEN'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Request-Id',
  ],
};

app.use(cors(corsOptions));
app.use(globalRateLimiter);
app.use(compression());
app.use(
  morgan(':method :url :status :response-time ms - :res[content-length]', {
    stream: morganStream,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
app.use(
  '/uploads',
  express.static(uploadDir, { maxAge: '7d', immutable: true }),
);

app.use('/api/auth', authRoutes);

app.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'localmart-api',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'localmart-api',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
