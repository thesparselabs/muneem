import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// The 4 GB-class profile: one fork with the heap capped as the Electron main process would be.
export default defineConfig({
  resolve: { alias: { electron: resolve(__dirname, 'test/electron-stub.ts') } },
  test: {
    include: ['test/scale/**/*.scale.test.ts'], environment: 'node', fileParallelism: false, pool: 'forks', maxWorkers: 1, minWorkers: 1,
    poolOptions: { forks: { singleFork: true, execArgv: ['--max-old-space-size=1536'] } }, testTimeout: 3_600_000, hookTimeout: 7_200_000,
  },
});
