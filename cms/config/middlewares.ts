/**
 * The middleware list is Strapi's default with two tweaks:
 *  - `strapi::security` allows GCS as a media source so cover images render
 *    inside the admin panel preview.
 *  - `strapi::cors` allows the production frontend origin and local dev.
 *
 * Extra origins can be appended via the CORS_ORIGINS env var (comma-separated).
 */
export default ({ env }) => [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'storage.googleapis.com',
            `${env('GCS_BUCKET_NAME', '')}.storage.googleapis.com`,
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'storage.googleapis.com',
            `${env('GCS_BUCKET_NAME', '')}.storage.googleapis.com`,
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'https://fuelcue.com',
        'https://www.fuelcue.com',
        'http://localhost:5173',
        ...env.array('CORS_ORIGINS', []),
      ],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
