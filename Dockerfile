# Production all-in-one image: React SPA + Node API
# GitHub Pages cannot run this process. Deploy this image to Render/Fly/Cloud Run
# and set PUBLIC_API_URL (Pages) to that HTTPS origin.

FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=
ENV VITE_BASE_PATH=/
ENV VITE_ROUTER_MODE=history
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache dumb-init wget
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend /fe/dist ./frontend/dist
RUN mkdir -p ./data/uploads && chown -R node:node /app
USER node
ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT:-5001}/api/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
