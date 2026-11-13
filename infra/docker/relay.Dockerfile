# Pairing relay. Build from the repo root: docker build -f infra/docker/relay.Dockerfile -t amana-relay .
FROM node:22-alpine
WORKDIR /app
COPY services/relay/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY services/relay/src ./src
ENV PORT=8080 NODE_ENV=production
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "src/server.js"]
