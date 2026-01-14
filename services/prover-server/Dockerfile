# Use the official Rust image as the base
FROM rust:1.90 AS builder

# Set working directory
WORKDIR /app

# Copy the Cargo.toml and Cargo.lock files
COPY services/prover-server/Cargo.toml services/prover-server/Cargo.lock ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (this layer will be cached if Cargo.toml doesn't change)
RUN cargo build --release && rm -rf src

# Copy the actual source code
COPY services/prover-server/src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Create a non-root user
RUN useradd -r -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/server /app/server

# Change ownership to appuser (but keep certs readable)
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the ports (9816 for HTTP, 55688 for wstcp proxy)
EXPOSE 9816 55688

# Run the binary
CMD ["sh", "-c", "RUST_LOG=Debug ./server"]