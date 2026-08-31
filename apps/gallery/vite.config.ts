import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // On Netlify, the gallery is built into /examples/ under the docs site — see netlify.toml.
  base: process.env.NETLIFY ? '/examples/' : '/',
  resolve: {
    alias: {
      'snapshot-core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
});
