# ── Stage 1: Build the Go binary ─────────────────────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /build

# Cache dependency downloads separately from source.
COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o judge-service .

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install language runtimes and utilities.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    golang-go \
    python3 \
    python3-pip \
    ruby \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled Go binary.
COPY --from=builder /build/judge-service .

# Copy runner scripts.
COPY runners/ ./runners/

# Make runner scripts executable.
RUN chmod +x ./runners/python_runner.py \
              ./runners/ruby_runner.rb \
              ./runners/js_runner.js

# Non-root user for security.
RUN useradd -m -u 1001 judge
USER judge

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

CMD ["./judge-service"]
