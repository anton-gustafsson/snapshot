import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@anton-gustafsson/snapshot-core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
});
