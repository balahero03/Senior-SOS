# syntax=docker/dockerfile:1
# SeniorSOS frontend image: the Vite build served by nginx, which also proxies
# /api and /socket.io to the backend so the browser talks to a single origin
# (the same arrangement the Vite dev server gives in development).

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# The nginx image fills ${VARIABLES} in /etc/nginx/templates/*.template from the
# environment at start-up. BACKEND_HOST is where /api and /socket.io are sent
# (compose: "backend:5000", Kubernetes: the backend Service). The resolvers are
# read from the container's own DNS settings, so the same image works in Docker
# and in Kubernetes without editing the config.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    BACKEND_HOST=backend:5000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
