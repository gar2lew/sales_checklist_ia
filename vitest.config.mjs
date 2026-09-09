import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs', 'tests/**/*.spec.mjs'],
    environment: 'node',
    pool: 'threads',
    testTimeout: 120000,
    hookTimeout: 120000
  }
});