import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/node_modules/**'],
    },
  },
});
