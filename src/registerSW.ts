import { registerSW } from 'virtual:pwa-register';

/**
 * Force a full page reload when a new service-worker activates.
 *
 * vite-pwa's `registerType: 'autoUpdate'` (combined with `skipWaiting` +
 * `clientsClaim` in workbox config) installs the new SW in the background,
 * but the running page keeps its in-memory JS modules — so users on an
 * already-open tab don't pick up new code until they manually hard-reload.
 * That's been the cause of "I deployed but my changes aren't showing up
 * even in incognito" reports.
 *
 * `onNeedRefresh` fires when the new SW has installed and is ready to take
 * over. We immediately call `updateSW()` (which does the take-over) and
 * then `window.location.reload()` so the now-controlled page fetches the
 * fresh HTML + new chunk hashes.
 */

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Take over control + reload. Do not prompt — for fuelcue we'd rather
    // ship the fresh build than ask the user.
    updateSW(true).then(() => {
      window.location.reload();
    });
  },
});
