import { defineConfig } from 'vite';

// base './' so the built folder can be served from any path (Release asset).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
