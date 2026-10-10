import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', env: { DATABASE_URL: ':memory:' } },
});
