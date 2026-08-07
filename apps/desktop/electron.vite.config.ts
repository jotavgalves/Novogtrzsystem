import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const resolveFromApp = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['@gtrz/contracts', '@gtrz/database', '@gtrz/domain'],
      },
      rollupOptions: {
        external: ['better-sqlite3'],
        input: resolveFromApp('./src/main/index.ts'),
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: resolveFromApp('./src/preload/index.ts'),
        output: {
          entryFileNames: 'index.cjs',
          format: 'cjs',
          inlineDynamicImports: true,
        },
      },
    },
  },
  renderer: {
    root: resolveFromApp('./src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolveFromApp('./src/renderer/src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolveFromApp('./src/renderer/index.html'),
      },
    },
  },
});
