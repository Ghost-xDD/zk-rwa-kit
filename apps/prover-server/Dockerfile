# Zk-RWA-Kit TLSNotary Prover Server
# Multi-stage build for smaller image size

FROM rust:1.83 AS builder

WORKDIR /app

# Copy Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Create dummy source for dependency caching
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "pub fn run_ws_server(_: &crate::config::Config) -> impl std::future::Future<Output = Result<(), eyre::ErrReport>> { async { Ok(()) } } pub mod config { pub struct Config { pub ws_port: u16, pub server_uri: http::Uri, pub wstcp_proxy_port: u16, pub session_timeout_secs: u64, pub ws_host: String } impl Config { pub fn from_env() -> Self { Self { ws_port: 9816, server_uri: \"https://localhost\".parse().unwrap(), wstcp_proxy_port: 55688, session_timeout_secs: 120, ws_host: \"0.0.0.0\".into() } } pub fn server_domain(&self) -> String { \"localhost\".into() } pub fn server_port(&self) -> u16 { 443 } } }" > src/lib.rs

# Build dependencies (cached layer)
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Copy actual source code
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime stage - smaller image
FROM debian:bookworm-slim

# Install CA certificates for TLS
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false appuser

WORKDIR /app

# Copy the binary
COPY --from=builder /app/target/release/zk-rwa-prover /app/prover-server

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

# Expose ports (WebSocket + WSTCP proxy)
EXPOSE 9816 55688

# Environment variables
ENV RUST_LOG=info
ENV MOCK_BANK_URL=https://mock-bank:3002/api/account

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:9816/health || exit 1

# Run the prover server
CMD ["./prover-server"]