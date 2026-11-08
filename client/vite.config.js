import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Use the same PORT as the API server (from restock/.env), default 3456.
if (fs.existsSync('../.env')) process.loadEnvFile('../.env');
const apiPort = process.env.PORT || 3456;

// Dev: Vite serves the UI on :5173 and forwards /api to Express.
// Prod: Express serves client/dist itself (one Render service).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The Scenario Lab runs the REAL Guardian (pure code) in the browser.
  resolve: { alias: { '@guardian': path.resolve(here, '../server/guardian') } },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [path.resolve(here, '..')] }, // reachable from your phone on the same Wi-Fi (for the QR approve flow)
    proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true } },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        // Split the heavy data-viz libraries so the landing page loads fast.
        manualChunks(id) {
          if (id.includes('ag-grid')) return 'ag-grid';
          if (id.includes('ag-charts')) return 'ag-charts';
          if (id.includes('framer-motion') || id.includes('motion-dom')) return 'motion';
        },
      },
    },
  },
});
