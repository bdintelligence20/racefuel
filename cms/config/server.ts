export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Stable signing keys across deploys. Cloud Run rotates instances on every
  // revision, so APP_KEYS must come from a secret rather than being
  // re-generated per boot — otherwise existing admin sessions break and
  // anything signed with the old keys (e.g. password-reset emails) stops
  // verifying.
  app: {
    keys: env.array('APP_KEYS'),
  },
  // PUBLIC_URL drives absolute asset URLs the frontend receives. When
  // serving uploads via GCS the provider returns absolute URLs and this
  // mostly governs admin-panel links.
  url: env('PUBLIC_URL', undefined),
});
