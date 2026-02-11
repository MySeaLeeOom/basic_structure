FROM rust:latest as builder

WORKDIR /usr/src/auth
COPY Cargo.toml Cargo.lock* ./
# Create dummy file to build dependencies
RUN mkdir -p src
RUN echo "fn main() {}" > src/main.rs
RUN cargo build --release
# Remove dummy build artifacts to force rebuild of main
RUN rm -f target/release/deps/auth*

# Copy actual source
COPY src ./src
# Build actual app
RUN cargo build --release

FROM debian:bookworm-slim
# Install CA certificates for HTTPS requests (GitHub OAuth)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/auth/target/release/auth /usr/local/bin/auth
CMD ["auth"]
