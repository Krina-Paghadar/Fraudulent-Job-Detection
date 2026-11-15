import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works from any sub-path (e.g. GitHub Pages
// project pages) without extra configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
