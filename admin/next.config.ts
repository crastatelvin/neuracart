import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The workspace root is intentionally the repo root because the admin panel
  // shares the backend/client DTOs; this silences a duplicate-lockfile warning.
  eslint: { ignoreDuringBuilds: false },
  outputFileTracingRoot: path.resolve('./..'),
};

export default nextConfig;
