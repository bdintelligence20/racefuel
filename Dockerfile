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
    npm run build
# products.ts + XML feed are generated as part of `npm run build`
RUN cp public/products-feed.xml dist/products-feed.xml

FROM nginx:alpine
RUN apk add --no-cache nodejs
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/scripts/generate-xml-feed.mjs /opt/feed/generate-xml-feed.mjs
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Hourly cron to refresh the XML feed (stock levels, pricing, availability)
RUN echo '0 * * * * FEED_OUTPUT_PATH=/usr/share/nginx/html/products-feed.xml node /opt/feed/generate-xml-feed.mjs >> /var/log/feed.log 2>&1' | crontab -

EXPOSE 8080
CMD crond && nginx -g 'daemon off;'
