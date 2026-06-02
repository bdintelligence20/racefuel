FROM node:20-alpine AS build
ARG VITE_STRAVA_CLIENT_ID
ARG VITE_STRAVA_CLIENT_SECRET
ARG VITE_MAPBOX_TOKEN
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
# No Gemini API key in the build anymore — AI runs via Firebase AI Logic (App Check).
# reCAPTCHA *site* key is public by design.
ARG VITE_RECAPTCHA_SITE_KEY
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN VITE_STRAVA_CLIENT_ID=$VITE_STRAVA_CLIENT_ID \
    VITE_STRAVA_CLIENT_SECRET=$VITE_STRAVA_CLIENT_SECRET \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    npm run build
# products.ts + XML feed are generated as part of `npm run build`
RUN cp public/products-feed.xml dist/products-feed.xml

FROM nginx:alpine
RUN apk add --no-cache nodejs
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/scripts/generate-xml-feed.mjs /opt/feed/scripts/generate-xml-feed.mjs
# Ship the override + cache files alongside the script so the runtime cron
# resolves nutrition through the same priority chain the build does
# (overrides > regex > cache). Without these the cron was wiping the
# build-time feed with a broken one (override=0, ai=0, missing=102).
COPY --from=build /app/data /opt/feed/data
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Hourly cron to refresh stock levels + pricing from Shopify. Re-running the
# script with the bundled overrides/cache preserves nutrition data even
# without a Gemini API key (we just lose the AI fallback for newly-added
# products, which is acceptable until the next deploy).
RUN echo '0 * * * * FEED_OUTPUT_PATH=/usr/share/nginx/html/products-feed.xml node /opt/feed/scripts/generate-xml-feed.mjs >> /var/log/feed.log 2>&1' | crontab -

EXPOSE 8080
CMD crond && nginx -g 'daemon off;'
