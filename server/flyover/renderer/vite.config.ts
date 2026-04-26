import { defineConfig } from 'vite';

// Mapbox GL JS itself is loaded from CDN in index.html as a global; animation.ts only
// imports it as a type, so it's tree-shaken out of the bundle. The build emits a single
// IIFE that exposes window.__renderFlyover for the headless server to drive.
export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
    minify: 'esbuild',
  },
});
