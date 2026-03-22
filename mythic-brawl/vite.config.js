import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    port: 8080,
    open: true,
    allowedHosts: ['.ngrok-free.dev'],
    proxy: {
      '/colyseus': {
        target: 'ws://localhost:2567',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ''),
      },
    },
  },
});
