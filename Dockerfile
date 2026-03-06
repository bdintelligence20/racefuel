FROM node:20-alpine AS build
ARG VITE_STRAVA_CLIENT_ID
ARG VITE_STRAVA_CLIENT_SECRET
ARG VITE_MAPBOX_TOKEN
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN VITE_STRAVA_CLIENT_ID=$VITE_STRAVA_CLIENT_ID \
    VITE_STRAVA_CLIENT_SECRET=$VITE_STRAVA_CLIENT_SECRET \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
    npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
