/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRAVA_CLIENT_ID: string;
  readonly VITE_STRAVA_CLIENT_SECRET: string;
  readonly VITE_STRAVA_REDIRECT_URI?: string;
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_STRAPI_URL?: string;
  readonly VITE_STRAPI_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
