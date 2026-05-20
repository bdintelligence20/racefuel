/**
 * Shared CORS origin allowlisting for the public HTTP functions the SPA
 * calls directly from the browser (createCheckout, listShopifyProducts, …).
 *
 * The old per-file `Set` only held four origins — the two prod domains, the
 * legacy Cloud Run URL, and `http://localhost:5173`. Anything else got the
 * `https://fuelcue.com` fallback in Access-Control-Allow-Origin, which the
 * browser rejects as a mismatch and surfaces as the opaque "Failed to fetch".
 *
 * That stranded every non-canonical origin the app is legitimately served
 * from: a Firebase preview channel, `fuelcue.web.app`, `vite preview` on
 * :4173, a bumped dev port (:5174 when :5173 is taken), or a phone hitting
 * the LAN URL printed by `npm run dev:mobile`. This matcher accepts them all.
 */

const STATIC_ALLOWED = new Set([
  'https://fuelcue.com',
  'https://www.fuelcue.com',
  'https://fuelcue.firebaseapp.com',
  'https://racefuel-dtlkpe56ha-uc.a.run.app',
]);

// Firebase Hosting default domain + preview channels for the `fuelcue` site,
// e.g. https://fuelcue.web.app and https://fuelcue--pr12-ab3d.web.app
const FIREBASE_HOSTING = /^https:\/\/fuelcue(--[a-z0-9-]+)?\.web\.app$/;

// Local dev + `vite preview` on any port — loopback or a private LAN IP, so
// `dev:mobile` / `preview:mobile` work when the LAN URL is opened on a phone.
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const LAN_IP =
  /^http:\/\/(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined | null): origin is string {
  if (!origin) return false;
  return (
    STATIC_ALLOWED.has(origin) ||
    FIREBASE_HOSTING.test(origin) ||
    LOCALHOST.test(origin) ||
    LAN_IP.test(origin)
  );
}

/**
 * The value for Access-Control-Allow-Origin: the caller's own origin when we
 * recognise it, else the canonical prod origin as a safe default.
 */
export function resolveAllowedOrigin(origin: string | undefined | null): string {
  return isAllowedOrigin(origin) ? origin : 'https://fuelcue.com';
}
