/**
 * Self-unregister: kills any service worker that previous builds left
 * behind on the user's device and wipes its caches.
 *
 * After repeated cache-related "I don't see new deploys" reports, we've
 * removed the SW entirely. This module's only job is to evict whatever
 * SW + Cache Storage entries earlier builds installed. After the first
 * page load with this code in it, no SW is ever registered again, so
 * every future request goes straight to the network. nginx's
 * Cache-Control headers (no-cache on index.html, immutable on hashed
 * /assets/) handle the rest.
 */

async function killAllServiceWorkers(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  let killedAny = false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      try {
        const ok = await reg.unregister();
        if (ok) killedAny = true;
      } catch {
        /* one bad registration shouldn't stop the others */
      }
    }
  } catch {
    /* getRegistrations can throw — best-effort */
  }
  return killedAny;
}

async function clearAllCaches(): Promise<boolean> {
  if (!('caches' in window)) return false;
  let clearedAny = false;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.map(async (n) => {
        try {
          await caches.delete(n);
          clearedAny = true;
        } catch {
          /* ignore */
        }
      })
    );
  } catch {
    /* keys() can throw — best-effort */
  }
  return clearedAny;
}

(async () => {
  const swKilled = await killAllServiceWorkers();
  const cacheCleared = await clearAllCaches();
  // If we evicted anything stale, force a reload so the page picks up
  // fresh content via the network. We use a sessionStorage guard so a
  // misbehaving setup can't put us in a reload loop.
  if (swKilled || cacheCleared) {
    const k = 'fuelcue_sw_killed_at';
    const last = Number(sessionStorage.getItem(k) || '0');
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(k, String(Date.now()));
      window.location.reload();
    }
  }
})();
