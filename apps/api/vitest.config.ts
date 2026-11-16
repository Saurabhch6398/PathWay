import { configDefaults, defineConfig } from 'vitest/config';

// `integration/` needs a real MongoDB and has its own config (npm run test:integration).
export default defineConfig({
  test: { setupFiles: ['tests/setup.ts'], exclude: [...configDefaults.exclude, 'integration/**'] },
});
