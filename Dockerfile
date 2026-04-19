# syntax=docker/dockerfile:1.7
#
# VOLANS Cloud Run image.
#
# Next.js 16 + Turbopack does not yet emit the `standalone` bundle, so this
# Dockerfile copies node_modules + .next to the runtime image. The image is
# larger (~250-350 MB) but stable across Turbopack releases.
#
# When standalone support lands, replace the runtime section with a copy of
# .next/standalone + .next/static + public only.
# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm i --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm i; \
    fi

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

# Copy the full Next app tree. Could be slimmed further with next-standalone
# once Turbopack emits it.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

USER nextjs
EXPOSE 8080
CMD ["npm", "run", "start", "--", "-p", "8080", "-H", "0.0.0.0"]
