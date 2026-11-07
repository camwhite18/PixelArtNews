import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// In dev, the Go server runs on :8080 and serves the API and media.
export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/media': 'http://localhost:8080',
    },
  },
});
