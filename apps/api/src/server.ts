import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { createApp } from './app';
import { loadEnv } from './config/env';

async function main() {
  const env = loadEnv();
  const production = env.NODE_ENV === 'production';

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log('MongoDB connected');
  // Build indexes before accepting traffic: the unique indexes are what make double-booking and
  // duplicate applications impossible under concurrent requests.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  const app = createApp({
    ...env,
    // apps/api/dist/server.js and apps/api/src/server.ts both resolve to apps/web/dist.
    staticDir:
      env.STATIC_DIR ??
      (production ? fileURLToPath(new URL('../../web/dist', import.meta.url)) : undefined),
    trustProxy: env.TRUST_PROXY ?? (production ? 1 : 0),
    logRequests: production,
  });
  const server = app.listen(env.PORT, () =>
    console.log(`API listening on http://localhost:${env.PORT}`),
  );

  const shutdown = async () => {
    console.log('Shutting down');
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
