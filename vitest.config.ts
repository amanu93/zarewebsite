import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    // The bench suites exercise the business rules through the in-memory
    // demo store; at runtime the portal always talks to the landing-api.
    env: { NEXT_PUBLIC_BENCH_DEMO_MODE: 'true' },
  },
});
