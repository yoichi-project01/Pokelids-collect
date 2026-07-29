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
COPY --from=api-build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=api-build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=mobile-build --chown=node:node /repo/apps/mobile/dist apps/api/public

WORKDIR /repo/apps/api
USER node
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
