import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// A release build keeps source maps for crash symbolication without linking them; electron-builder leaves them out.
const sourcemap = process.env.MUNEEM_SOURCEMAPS === '1' ? 'hidden' : false;

export default defineConfig({
  main: {
    // Native + workspace deps stay external: better-sqlite3 / @node-rs/argon2 are loaded from node_modules at runtime.
    plugins: [externalizeDepsPlugin()],
    // The sync utility process (7d) and the read worker thread (ADR-0058) are further entries, emitted beside index.js.
    build: { sourcemap, rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts'), 'sync-worker': resolve(__dirname, 'src/sync-worker/index.ts'), 'read-worker': resolve(__dirname, 'src/read-worker/index.ts') }, output: { format: 'es' } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // Sandboxed preloads must be CommonJS (Electron requirement).
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts'), output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    build: { sourcemap, rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  },
});
