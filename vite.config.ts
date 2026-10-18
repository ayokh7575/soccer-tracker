/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => ({
  // Served from a subpath on GitHub Pages, from the root in dev.
  base: mode === 'production' ? '/soccer-tracker/' : '/',
  plugins: [react()],
  define: {
    // Test builds (npm run deploy:test) show e.g. "0.1.31-test 18 Oct 22:40" in
    // the footer, so it's obvious which build a phone is actually running.
    __APP_VERSION__: JSON.stringify(
      process.env.TEST_BUILD
        ? `${pkg.version}-test ${new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}`
        : pkg.version
    ),
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: false,
  },
}));
