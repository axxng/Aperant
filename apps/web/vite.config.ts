import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    projects: [
      {
        // API tests — node environment (unchanged)
        extends: true,
        test: {
          name: 'api',
          globals: true,
          environment: 'node',
          include: ['api/**/*.test.ts'],
        },
      },
      {
        // Frontend component tests — jsdom environment
        extends: true,
        test: {
          name: 'frontend',
          globals: true,
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
          setupFiles: ['src/test-setup.ts'],
        },
      },
    ],
  },
});
