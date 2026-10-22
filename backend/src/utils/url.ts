import { env } from '../config/env';

export function absoluteAssetUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  return `${env.PUBLIC_API_URL.replace(/\/$/, '')}${value}`;
}
