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
      // No precaching of the app shell — every request flows to the network
      // (where nginx's no-cache on index.html + immutable on hashed chunks
      // handles browser-side caching). This is intentional: the previous
      // setup precached every JS bundle, and on a deploy users on an open
      // tab kept seeing stale code until they manually hard-reloaded. With
      // precache empty, fresh deploys land for users on the next page load
      // with zero intervention.
      //
      // The SW is still present (for installability + the runtime cache of
      // mapbox tiles), it just doesn't gate the app shell anymore.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: [],
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
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
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
