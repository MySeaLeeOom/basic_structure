# Stage 1: Builder
FROM rust:1-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY Cargo.toml Cargo.lock ./

RUN mkdir src && \
	echo "fn main() {}" > src/main.rs && \
	cargo build --release && \
	rm -rf src

COPY . .

# renew the timestamp so that cargo realizes the changes + compile
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime
FROM debian:stable-slim AS runtime

WORKDIR /usr/src/app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    netcat-traditional \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/editor .
COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

EXPOSE 3004

ENTRYPOINT ["./entrypoint.sh"]
CMD ["./editor"]