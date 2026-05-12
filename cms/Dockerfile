# Self-hosted Strapi v5 for the fuelcue blog. Deployed as a separate Cloud
# Run service from the main /racefuel container; both share the same GCP
# project but live on independent revisions.
#
# Two-stage build keeps the runtime image small: stage 1 installs the full
# dependency tree (incl. dev deps so `strapi build` works) and produces the
# admin-panel bundle under /opt/app/dist; stage 2 installs production-only
# deps and copies that bundle in.
FROM node:20-alpine AS build

# better-sqlite3 needs a native build; the rest are common Strapi deps that
# also benefit from these tools when their prebuilds aren't available for
# alpine.
RUN apk add --no-cache python3 build-base vips-dev

WORKDIR /opt/app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine

# libvips is needed at runtime by sharp (Strapi's image processor).
RUN apk add --no-cache vips-dev

ENV NODE_ENV=production

WORKDIR /opt/app

# Production install — skip dev deps. Keep --legacy-peer-deps in sync with
# the build stage so npm resolves the same plugin tree.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy source + the pre-built admin bundle.
COPY --from=build /opt/app/dist ./dist
COPY --from=build /opt/app/config ./config
COPY --from=build /opt/app/src ./src
COPY --from=build /opt/app/public ./public
COPY --from=build /opt/app/tsconfig.json ./tsconfig.json

EXPOSE 1337

CMD ["npm", "run", "start"]
