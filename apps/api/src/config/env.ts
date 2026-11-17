import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  // Directory of the built web app. Defaults to apps/web/dist when NODE_ENV=production.
  STATIC_DIR: z.string().optional(),
  // Number of reverse proxies in front of the app (Render, Railway, Nginx = 1). Defaults to 1 in production.
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
  GEMINI_API_KEY: z.string().optional(),
  // Comma-separated, tried in order if one is unavailable.
  GEMINI_MODELS: z.string().default('gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash,gemini-flash-latest,gemini-flash-lite-latest'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODELS: z.string().default('llama-3.3-70b-versatile,llama-3.1-8b-instant'),
  // When 'true', enables offline intelligent mock responses if no API key is provided
  AI_OFFLINE_MODE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Validates the given env. The app refuses to start with missing/weak secrets. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

let cached: Env | undefined;
/** Memoized process.env validation, for modules that need config at request time. */
export const getEnv = (): Env => (cached ??= loadEnv());
