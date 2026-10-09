# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=ai2dot-npm,target=/root/.npm \
  npm ci --prefer-offline

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG AI2DOT_REVERSE_PROXY=true
ARG DEPLOYMENT_VERSION
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENV AI2DOT_REVERSE_PROXY=$AI2DOT_REVERSE_PROXY
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

RUN --mount=type=cache,id=ai2dot-next,target=/app/.next/cache \
  npm run build

FROM base AS migrator
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "db:migrate:container"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV KEEP_ALIVE_TIMEOUT=65000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
