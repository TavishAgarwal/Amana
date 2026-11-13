# Wallet (APP=wallet) or counsellor console (APP=console), Next.js standalone output.
# AMANA_API and NEXT_PUBLIC_RELAY_URL are fixed at build time (Next.js bakes rewrites and public env in).
# Build from the repo root:
#   docker build -f infra/docker/web.Dockerfile --build-arg APP=wallet -t amana-wallet .
FROM node:22-alpine AS build
ARG APP=wallet
ARG AMANA_API=http://api:8000
ARG NEXT_PUBLIC_RELAY_URL=
ENV AMANA_API=$AMANA_API NEXT_PUBLIC_RELAY_URL=$NEXT_PUBLIC_RELAY_URL AMANA_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui ./packages/ui
COPY apps/$APP/package.json ./apps/$APP/
RUN pnpm install --frozen-lockfile --filter "@amana/$APP..."
COPY apps/$APP ./apps/$APP
RUN mkdir -p apps/$APP/public && pnpm -C apps/$APP build

FROM node:22-alpine
ARG APP=wallet
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node /repo/apps/$APP/.next/standalone ./
COPY --from=build --chown=node /repo/apps/$APP/.next/static ./apps/$APP/.next/static
COPY --from=build --chown=node /repo/apps/$APP/public ./apps/$APP/public
RUN ln -s /app/apps/$APP /app/current
USER node
EXPOSE 3000
CMD ["node", "current/server.js"]
