# syntax=docker/dockerfile:1
# SeniorSOS backend image (Express + Socket.IO + Prisma).
#
# No secrets are baked in: .env is excluded by .dockerignore, and every setting
# (database URLs, JWT secrets, REDIS_URL, ...) is supplied at run time.

# ─── Build stage: install dependencies and generate the Prisma client ────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Prisma's engines need OpenSSL, and TLS connections need CA certificates.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# The client is generated for this image's platform (Linux), not the host's.
COPY prisma ./prisma
RUN npx prisma generate

# Drop devDependencies (nodemon, the Prisma CLI); the generated client stays.
RUN npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src

# Never run as root.
USER node

EXPOSE 5000

# Ready when the HTTP server answers; /health does not depend on any database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
