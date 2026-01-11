# Zk-RWA-Kit Webapp
# Multi-stage build: Node for building, Caddy for serving

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tlsn-wasm-pkg ./tlsn-wasm-pkg/

# Install dependencies
RUN npm ci || npm install

# Copy source code
COPY . .

# Build arguments for configuration
ARG PROVER_PROXY_URL=wss://localhost/prove
ARG RELAYER_URL=http://localhost:3001
ARG CHAIN_EXPLORER_URL=https://sepolia.mantlescan.xyz

ENV PROVER_PROXY_URL=${PROVER_PROXY_URL}
ENV RELAYER_URL=${RELAYER_URL}
ENV CHAIN_EXPLORER_URL=${CHAIN_EXPLORER_URL}

# Build the application
RUN npx webpack --config webpack.js --mode production

# Production stage - Caddy serves with COOP/COEP headers
FROM caddy:alpine

# Copy Caddy configuration (includes required headers for SharedArrayBuffer)
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built files
COPY --from=builder /app/build /usr/share/caddy

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

