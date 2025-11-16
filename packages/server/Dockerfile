# Use Node.js LTS image instead of Bun for better native module compatibility
FROM node:20-slim AS base
WORKDIR /app

# Install git, nginx, and build essentials
RUN apt-get update && apt-get install -y git nginx curl unzip && rm -rf /var/lib/apt/lists/*

# Install Bun (we still need it for some operations)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install PM2 globally
RUN npm install -g pm2

# Copy workspace configuration
COPY package.json bun.lock* ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (ignore optional native dependencies)
RUN bun install --no-optional

# Remove problematic native module that causes crashes on ARM64
RUN rm -rf node_modules/msgpackr-extract node_modules/@msgpackr-extract || true

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy server source
COPY packages/server ./packages/server

# Copy nginx configuration
COPY packages/server/nginx.conf /etc/nginx/nginx.conf

# Expose nginx and server ports
EXPOSE 80 3333

# Create directory for deployed apps
RUN mkdir -p /tmp/devver-apps

# Create nginx sites-enabled directory
RUN mkdir -p /etc/nginx/sites-enabled

# Start nginx and the server
# Keep using Bun but preload to disable native acceleration
ENV MSGPACKR_NATIVE_ACCELERATION_DISABLED=true
CMD service nginx start && bun run packages/server/src/index.ts
