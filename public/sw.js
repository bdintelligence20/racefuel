/**
 * Self-uninstalling service worker.
 *
 * Earlier fuelcue builds shipped via vite-plugin-pwa registered a
 * precache-everything service worker. When we ripped vite-plugin-pwa
 * out (commit 744cf5d) to fix the recurring "users don't see new
 * deploys" problem, we left those existing SWs in place on user
 * devices with no path to remove themselves — there was no new sw.js
 * for them to update to.
 *
 * This file plugs that gap. It's a static, hand-rolled service worker
 * served at /sw.js so the browser's update check finds it. On install
 * it clears every cache, then on activate it unregisters itself and
 * reloads every controlled client. After one cycle of this, no SW
 * remains on the user's device and every future request goes straight
 * to nginx.
 */

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for old clients to close.
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch {
        /* best-effort */
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.registration.unregister();
      } catch {
        /* best-effort */
      }
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          // navigate() forces the page to refetch from network; since
          // we've just unregistered, no SW intercepts the new request.
          if ('navigate' in client) {
            try {
              await client.navigate(client.url);
            } catch {
              /* some browsers reject navigate() across origins; ignore */
            }
          }
        }
      } catch {
        /* best-effort */
      }
    })()
  );
});

// While the new SW is briefly active (before it unregisters), make sure
// it serves nothing from cache. Pure pass-through to the network so the
// transition window can't keep stale content alive.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
