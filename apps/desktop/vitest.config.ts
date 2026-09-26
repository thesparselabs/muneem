import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: { alias: { electron: resolve(__dirname, 'test/electron-stub.ts') } },
  test: { include: ['test/**/*.test.ts'], environment: 'node', fileParallelism: false },
});
