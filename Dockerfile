# Stage 1: Base image with Bun
FROM oven/bun:1.2.17 AS base
WORKDIR /app

# Install dependencies needed for native modules and FFmpeg download
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    linux-libc-dev \
    dumb-init \
    curl \
    bash \
    ca-certificates \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Set NVIDIA driver capabilities environment variable for NVENC access
ENV NVIDIA_DRIVER_CAPABILITIES=all

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
# Download FFmpeg binaries during build
RUN bash scripts/download-ffmpeg.sh
RUN bun run build

# Stage 5: Production image  
FROM oven/bun:1.2.17 AS production

# Note: Using existing 'bun' user (UID/GID 1000) from base image
# This matches common host user configuration and avoids permission issues

# Set working directory
WORKDIR /app

# Copy package files and production dependencies
COPY --chown=bun:bun package.json bun.lock ./
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=bun:bun /app/build ./build

# Copy FFmpeg binaries
COPY --from=build --chown=bun:bun /app/binaries ./binaries

# Create necessary directories with proper ownership
RUN mkdir -p data incoming incoming/thumbnails && \
    chown -R bun:bun data incoming

# Switch to non-root user
USER bun

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
