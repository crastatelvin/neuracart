import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8000),
    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    OTP_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(10),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(60),
    OTP_PEPPER: z.string().min(32),

    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default('onboarding@resend.dev'),
    EMAIL_FROM_NAME: z.string().default('LocalMart'),
    SUPPORT_EMAIL: z.string().default('support@localmart.app'),

    CORS_ORIGINS: z
      .string()
      .default(
        'http://localhost:3000,http://localhost:8081,http://localhost:8082',
      )
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),

    UPLOAD_DIR: z.string().default('uploads'),
    MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
    PUBLIC_API_URL: z.string().url().default('http://localhost:8000'),

    STORE_TIMEZONE: z.string().default('Asia/Kolkata'),
    DELIVERY_FEE: z.coerce.number().nonnegative().default(40),
    FREE_DELIVERY_ABOVE: z.coerce.number().nonnegative().default(500),
    RIDER_PAYOUT: z.coerce.number().nonnegative().default(40),
    MAX_ACTIVE_ASSIGNMENTS: z.coerce.number().int().positive().default(3),
    SERVICE_PINCODES: z
      .string()
      .default('560001,560003,560034,560040,560095')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ENABLE_ONLINE_PAYMENTS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

    SENTRY_DSN: z.string().default(''),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === 'production' && !values.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Do not use the application logger here: it depends on env.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
});

export type Env = typeof env;
