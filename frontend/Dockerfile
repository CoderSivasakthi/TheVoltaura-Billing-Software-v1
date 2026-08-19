# ─────────────────────────────────────────────
# Stage 1: Build the React/Vite app
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package.json package-lock.json ./

RUN npm ci

# Same-origin /api when served behind nginx. Override at build time if needed.
ARG VITE_API_URL=
ARG VITE_BASE_PATH=/
ARG VITE_ROUTER_MODE=history
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_ROUTER_MODE=$VITE_ROUTER_MODE

# Copy source and build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Serve static files with Nginx
# ─────────────────────────────────────────────
FROM nginx:1.25-alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Minimal SPA nginx config for inner container (port 80)
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Run as root so nginx can bind port 80. USER nginx causes bind() EACCES
# on GitHub-hosted runners and makes `docker compose up` fail immediately.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
