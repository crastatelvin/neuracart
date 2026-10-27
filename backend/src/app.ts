import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { addressRoutes } from './modules/addresses/address.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { deliveryRoutes } from './modules/delivery/delivery.routes';
import { errorHandler } from './middleware/errorHandler';
import { orderRoutes } from './modules/orders/order.routes';
import { productRoutes } from './modules/products/product.routes';
import { storeRoutes } from './modules/store/store.routes';
import { streamUpdates } from './modules/realtime/realtime.routes';
import { recsRoutes } from './modules/recs/recs.routes';
import { reviewRoutes } from './modules/reviews/review.routes';
import { globalRateLimiter } from './middleware/rateLimiter';
import { notFound } from './middleware/notFound';
import { requestId } from './middleware/requestId';
import { AppError } from './utils/errors';
import { morganStream } from './utils/logger';
import { sendError, sendSuccess } from './utils/response';

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
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/recs', recsRoutes);
app.use('/api/reviews', reviewRoutes);
app.get('/api/updates', streamUpdates);

const healthHandler: express.RequestHandler = async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(
      res,
      {
        status: 'ok',
        message: 'Server is running',
        service: 'localmart-api',
        environment: env.NODE_ENV,
        database: 'up',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      'Server is running',
    );
  } catch {
    sendError(
      res,
      'Service unavailable',
      503,
      { database: 'down' },
      'DATABASE_DOWN',
    );
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use(notFound);
app.use(errorHandler);

export default app;
