import path from 'node:path';
import dotenv from 'dotenv';

// `pnpm dev` runs this with cwd = apps/backend, but the .env file lives at the
// repo root, so resolve it relative to this file instead of relying on cwd.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  PORT: parseInt(optional('PORT', '3000'), 10),
  DATABASE_URL: required('DATABASE_URL'),
  AUTH0_DOMAIN: required('AUTH0_DOMAIN'),
  AUTH0_AUDIENCE: required('AUTH0_AUDIENCE'),
  CORS_ORIGIN: optional('CORS_ORIGIN', '*'),
  NODE_ENV: optional('NODE_ENV', 'development'),
} as const;
