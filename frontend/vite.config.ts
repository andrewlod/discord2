import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@preload': path.resolve(__dirname, './src/preload'),
    },
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      clientPort: 5173,
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
});