import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev proxy: the browser only talks to :5173, so the refresh cookie (path /api/v1/auth,
// SameSite=Strict) works without CORS. /socket.io is proxied for group mode.
const API = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/socket.io': { target: API, ws: true, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/socket.io': { target: API, ws: true, changeOrigin: true },
    },
  },
  resolve: { alias: { '@': '/src' } },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: React + router + query change rarely; Leaflet only loads with maps
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 30 },
            { name: 'data', test: /node_modules[\\/](@tanstack|axios)[\\/]/, priority: 20 },
            { name: 'ui', test: /node_modules[\\/](@radix-ui|vaul|sonner|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/, priority: 20 },
            { name: 'leaflet', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{js,jsx}'],
    setupFiles: ['tests/unit/setup.js'],
  },
});
