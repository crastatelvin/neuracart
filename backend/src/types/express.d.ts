import type { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: AuthUser;
      validatedQuery?: unknown;
    }
  }
}

export {};
