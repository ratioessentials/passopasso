# PassoPasso: PWA (Vite) + API (Fastify, SQLite, Claude) in un'unica immagine.

# 1) Build della PWA
FROM node:22-slim AS web-build
WORKDIR /src/app/web
COPY app/web/package.json app/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/web/ ./
# Alcuni file della PWA possono leggere il brand o i contenuti
COPY brand/ /src/brand/
COPY content/ /src/content/
RUN npm run build

# 2) Build del server (TypeScript) e dipendenze di produzione
FROM node:22-slim AS server-build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src/app/server
COPY app/server/package.json app/server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/server/ ./
RUN npm run build && npm prune --omit=dev

# 3) Immagine finale
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3210 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    CONTENT_DIR=/app/content \
    WEB_DIST=/app/app/web/dist \
    HOME=/home/node
WORKDIR /app/app/server
COPY --from=server-build --chown=node:node /src/app/server/package.json ./
COPY --from=server-build --chown=node:node /src/app/server/node_modules ./node_modules
COPY --from=server-build --chown=node:node /src/app/server/dist ./dist
COPY --from=server-build --chown=node:node /src/app/server/fixtures ./fixtures
COPY --from=web-build --chown=node:node /src/app/web/dist /app/app/web/dist
COPY --chown=node:node content/ /app/content/
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3210
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3210)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
