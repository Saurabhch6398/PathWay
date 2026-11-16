import { defineConfig } from 'vitest/config';

// Runs the app against a REAL MongoDB. Set TEST_MONGODB_URI (a server, not a database; a temporary
// database is created and dropped). Without it the suite is skipped.
export default defineConfig({
  test: {
    include: ['integration/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
