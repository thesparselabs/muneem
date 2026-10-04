import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: { alias: { electron: resolve(__dirname, 'test/electron-stub.ts') } },
  // The 500k scale suite runs on its own (pnpm scale, nightly CI; vitest.scale.config.ts).
  test: { include: ['test/**/*.test.ts'], exclude: ['test/scale/**', '**/node_modules/**'], environment: 'node', fileParallelism: false },
});
