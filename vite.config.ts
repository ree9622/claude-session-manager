import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(args) {
          args.startup();
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['node-pty', 'electron-updater'],
            },
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart() {},
        vite: {
          build: {
            outDir: 'dist/preload',
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
});
