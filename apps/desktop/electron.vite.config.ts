import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    // Native + workspace deps stay external: better-sqlite3 / @node-rs/argon2 are loaded from node_modules at runtime.
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts'), output: { format: 'es' } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // Sandboxed preloads must be CommonJS (Electron requirement).
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts'), output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  },
});
