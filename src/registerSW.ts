import { registerSW } from 'virtual:pwa-register';

/**
 * Cache-aggressive SW registration with eviction of stale precache.
 *
 * Why eviction matters: the previous PWA config precached every JS bundle,
 * and on a deploy users with an open tab kept seeing stale code from the
 * SW's precache cache until they manually hard-reloaded. We've now disabled
 * precaching entirely (vite.config workbox globPatterns: []) so future
 * builds don't add anything to the cache, but the stale entries from
 * earlier builds are still in the user's browser. This first-load cleanup
 * removes them.
 *
 * Sequence on first load with the new SW:
 *   1. Old SW (with precache) takes over the request → may serve stale JS
 *   2. New SW (no precache) downloads + installs in background
 *   3. With skipWaiting + clientsClaim, new SW takes control of this client
 *   4. onNeedRefresh fires → we wipe every workbox-precache entry from
 *      Cache Storage and force a hard reload. The reload now hits a SW
 *      with empty precache → request goes to network → fresh chunks.
 *
 * After this first cleanup, every subsequent deploy lands on the user's
 * next reload with no SW interference.
 */

async function nukeStaleCaches() {
  if (!('caches' in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.includes('precache') || n.includes('workbox'))
        .map((n) => caches.delete(n))
    );
  } catch {
    /* swallow — cache.delete is best-effort */
  }
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
      .then(nukeStaleCaches)
      .then(() => {
        window.location.reload();
      });
  },
  onOfflineReady() {
    /* not used — we don't precache an offline shell */
  },
});

// Belt-and-braces: also nuke stale precache entries on every cold load,
// even if no SW update is detected. The user might've cached chunks from a
// build pre-this-fix that the SW won't otherwise clear.
nukeStaleCaches();
