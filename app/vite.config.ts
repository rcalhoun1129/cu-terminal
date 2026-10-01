import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Restricted athlete data under public/data is served by the dev server only; it is never copied into a build. */
const dropRestricted = (): Plugin => ({
  name: 'drop-restricted-data',
  apply: 'build',
  writeBundle(opts) {
    const dir = join(opts.dir || 'dist', 'data');
    try { for (const f of readdirSync(dir)) if (/\.restricted\./.test(f)) rmSync(join(dir, f)); } catch { /* no data dir */ }
  },
});

export default defineConfig({
  plugins: [react(), dropRestricted()],
  base: './',
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
