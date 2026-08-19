# ─────────────────────────────────────────────
# Node.js Express BFF (Backend-for-Frontend)
# ─────────────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache dumb-init wget

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Production-only install
RUN npm ci --production

# Copy application source files
COPY server.js ./
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# Create data directory for uploads instead of copying (as it's in .gitignore)
RUN mkdir -p ./data/uploads

# Use the built-in non-root node user
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5001/api/health || exit 1

# dumb-init handles signals properly for PID 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
