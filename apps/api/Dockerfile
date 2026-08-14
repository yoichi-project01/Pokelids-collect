FROM node:20-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared
RUN npm run build --workspace=@pokelids/shared

FROM deps AS mobile-build
COPY apps/mobile apps/mobile
WORKDIR /repo/apps/mobile
# EXPO_PUBLIC_* vars are baked into the web bundle at export time (Expo's
# babel plugin inlines process.env.EXPO_PUBLIC_* as string literals), not
# read at container runtime — so unlike every other GOOGLE_* var (read
# normally from .env at runtime by the api-build/final stages below), this
# one has to arrive as a build ARG instead. A Google OAuth web client ID is
# meant to be public (it's sent in the browser's own redirect URL to
# accounts.google.com either way — see apps/mobile's googleAuth.ts), so
# baking it into the publicly-served bundle isn't a secret leak the way the
# corresponding GOOGLE_CLIENT_SECRET would be.
ARG GOOGLE_CLIENT_ID
ENV EXPO_PUBLIC_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
# Same build-time-bake reasoning as GOOGLE_CLIENT_ID above — an AdSense
# publisher ID is meant to be public (it's right there in the <script src>
# URL any visitor's browser fetches), so baking it into the served bundle
# isn't a secret leak.
ARG ADSENSE_CLIENT_ID
ENV EXPO_PUBLIC_ADSENSE_CLIENT_ID=$ADSENSE_CLIENT_ID
RUN npx expo export -p web

FROM deps AS api-build
RUN apk add --no-cache openssl
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /repo

COPY --from=deps --chown=node:node /repo/package.json ./
COPY --from=api-build --chown=node:node /repo/node_modules ./node_modules
COPY --from=deps --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=api-build --chown=node:node /repo/apps/api/package.json apps/api/package.json
# npm workspaces doesn't always hoist a workspace's dependency to the root
# node_modules — it nests a package under apps/api/node_modules instead
# whenever hoisting it would conflict with a different version already
# resolved for another workspace (e.g. archiver@7 needs readable-stream@^4,
# but apps/mobile's tree already pins readable-stream@3 for something else).
# `npm dedupe` cannot collapse a genuine version conflict like that, so
# Node's module resolution has to be able to find the nested copy instead —
# it walks up from apps/api/dist through apps/api/node_modules before ever
# reaching the root one, so both directories need to exist in the image.
COPY --from=api-build --chown=node:node /repo/apps/api/node_modules apps/api/node_modules
COPY --from=api-build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=api-build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=mobile-build --chown=node:node /repo/apps/mobile/dist apps/api/public

WORKDIR /repo/apps/api
USER node
EXPOSE 3000


# 5-3. Migrations no longer run as part of this CMD — see docker-compose.yml's
# pokelids_migrate service for why. A failed `migrate deploy` used to fail
# this whole `sh -c` chain (via `&&`), so the container never reached
# `node dist/index.js` at all and crash-looped (2026-08-08's missing
# original_filename column took the entire site down, not just the one
# feature that needed the new column). Now this CMD only ever starts the
# app itself, which doesn't touch the DB until the first request — so even
# a broken schema degrades to /health reporting 503 (1-6) instead of the
# whole container refusing to start.
CMD ["node", "dist/index.js"]
