import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FuelCue — Nutrition Planner',
        short_name: 'FuelCue',
        description: 'Smart nutrition planning for endurance athletes. Upload a GPX route and get a personalized fueling plan with real products.',
        theme_color: '#FFF9F0',
        background_color: '#FFF9F0',
        display: 'standalone',
        orientation: 'any',
        categories: ['sports', 'health', 'fitness'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Activate new SW immediately instead of waiting for all tabs to close, and
        // let it take control of already-open clients. Without these, users with the
        // PWA open never pick up new deploys until they manually close every tab.
        skipWaiting: true,
        clientsClaim: true,
        // Nuke caches from previous Workbox revisions so stale bundles don't linger.
        cleanupOutdatedCaches: true,
        // Precache index.html as a navigation fallback so SPA routes still work offline,
        // but serve the network copy when available so stale HTML never shadows new JS.
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB (mapbox-gl is large)
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/[a-d]\.tiles\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-raster-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
