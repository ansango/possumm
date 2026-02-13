import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,js}'],
      exclude: ['src/**/*.{test,spec}.{ts,js}', 'src/index.ts']
    },
    expect: { requireAssertions: true },
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
