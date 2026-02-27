import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/api/venue-portal/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-${Date.now()}.[ext]`
      }
    }
  }
});