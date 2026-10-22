import type { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};
