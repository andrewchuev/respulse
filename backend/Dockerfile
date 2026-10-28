# syntax=docker/dockerfile:1

FROM rust:1.98-slim-trixie AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
# Migrations are embedded into the binary by sqlx::migrate! at compile time.
COPY migrations ./migrations
COPY src ./src

# Cache mounts keep the crate registry and incremental artifacts between builds;
# the binary is copied out because the target cache is not part of the image layer.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked \
    && cp target/release/respulse-api /respulse-api

# Same Debian release as the builder so the binary links against a matching glibc.
FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home --shell /usr/sbin/nologin respulse

COPY --from=builder /respulse-api /usr/local/bin/respulse-api

USER respulse
EXPOSE 8080
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["respulse-api"]
