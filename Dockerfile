# syntax=docker/dockerfile:1

# Node.js >= 24.22.1 is required: older builds bundle a Brotli decoder affected
# by CVE-2026-111497 ("HTTP2Shell"). Node 20 is EOL and will not be patched.
# apt-get upgrade pulls Debian security fixes (e.g. libbrotli, chromium).

############################
# 1. Dependencies
############################
FROM node:24.22.2-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# Use the distro Chromium at runtime instead of puppeteer's bundled download.
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm ci

############################
# 2. Builder
############################
FROM node:24.22.2-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A dummy DATABASE_URL so Prisma can generate during build (no DB access needed).
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
RUN npx prisma generate
RUN npm run build

############################
# 3. Runner
############################
FROM node:24.22.2-bookworm-slim AS runner
WORKDIR /app
# openssl (Prisma), ffmpeg (video encoding) and chromium + fonts (headless 3D
# animation rendering via puppeteer). The chromium package pulls in the
# required shared libraries.
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y \
      openssl ffmpeg chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
