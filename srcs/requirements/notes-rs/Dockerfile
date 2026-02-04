# Stage 1: Builder
FROM rust:1-slim AS builder

WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

# Stage 2: Runtime
FROM debian:stable-slim AS runtime

WORKDIR /usr/src/app

# Install netcat for the entrypoint script
RUN apt-get update && apt-get install -y netcat-traditional && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/notes-rs .
COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

EXPOSE 3003

ENTRYPOINT ["./entrypoint.sh"]
CMD ["./notes-rs"]
