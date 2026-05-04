import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VitePWA was removed deliberately. Earlier configurations (precache-everything,
// then empty-precache, then NetworkFirst) all left users stranded on stale
// builds: a ServiceWorker installed on a previous visit kept serving cached
// chunks until the user manually hard-reloaded.
//
// fuelcue.com now ships with no service worker at all. Every request goes to
// nginx, which is configured (in nginx.conf) to:
//   - serve index.html with `Cache-Control: no-cache, no-store, must-revalidate`
//   - serve hashed /assets/*.js with `Cache-Control: public, max-age=31536000, immutable`
//
// Combined effect: deploys land instantly on the user's next page load, with
// no SW interference. src/registerSW.ts contains a one-shot script that
// unregisters any leftover SW + clears Cache Storage on devices that
// previously visited the site, so existing users get the cleanup
// automatically on their next visit.
//
// To re-enable PWA later (offline support, Add-to-Home-Screen install
// prompt), add vite-plugin-pwa back with a NetworkFirst strategy on the app
// shell — never CacheFirst with precaching, which is what kept biting us.

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('mapbox-gl')) return 'mapbox';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('react-dom') || id.includes('react/')) return 'react';
          }
        },
      },
    },
  },
  plugins: [
    react(),
  ],
})
