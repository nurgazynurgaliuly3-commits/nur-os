FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4174

COPY package.json ./
COPY server.js app.js index.html styles.css manifest.webmanifest service-worker.js ./
COPY lib ./lib
COPY scripts ./scripts
COPY tests ./tests
COPY supabase-schema.sql render.yaml README.md DEPLOYMENT.md PRODUCTION_CHECKLIST.md ./

RUN addgroup -S nuros \
  && adduser -S nuros -G nuros \
  && mkdir -p .data \
  && chown -R nuros:nuros /app
USER nuros

EXPOSE 4174

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/check-live.js http://127.0.0.1:${PORT}/api/live || exit 1

CMD ["node", "server.js"]
