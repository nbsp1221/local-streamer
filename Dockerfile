# Stage 1: Base image with Bun
FROM oven/bun:1.2.17-alpine AS base
WORKDIR /app

# Install dependencies needed for native modules (ffmpeg-static, argon2)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    dumb-init

# Stage 2: Development dependencies
FROM base AS development-dependencies
# Copy package files for better caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 3: Production dependencies  
FROM base AS production-dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 4: Build stage
FROM base AS build
COPY package.json bun.lock ./
COPY --from=development-dependencies /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 5: Production image  
FROM oven/bun:1.2.17-alpine AS production

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Create non-root user for security
RUN addgroup -g 1001 -S bunuser && \
    adduser -S bunuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files and production dependencies
COPY --chown=bunuser:bunuser package.json bun.lock ./
COPY --from=production-dependencies --chown=bunuser:bunuser /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=bunuser:bunuser /app/build ./build

# Create necessary directories with proper ownership
RUN mkdir -p data incoming incoming/thumbnails && \
    chown -R bunuser:bunuser data incoming

# Switch to non-root user
USER bunuser

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check using bun
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run server with react-router-serve (same as local)
CMD ["bun", "run", "start"]
