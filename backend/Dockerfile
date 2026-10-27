FROM debian:trixie-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY target/release/alivemon-api /app/alivemon-api
COPY migrations /app/migrations

EXPOSE 8080
ENV PORT=8080
CMD ["/app/alivemon-api"]
