# syntax=docker/dockerfile:1.7

# ── Stage 1: Build the static binary ─────────────────────────────────────────
FROM golang:1.22-alpine AS builder
WORKDIR /src

# Cache the module graph before copying source.
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/auth-go \
    ./cmd/server

# ── Stage 2: Minimal runtime ─────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/JasonTM17/Leetrank_Project"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app

COPY --from=builder /out/auth-go /app/auth-go

USER nonroot:nonroot
EXPOSE 4011

ENV AUTH_PORT=4011

# distroless doesn't ship wget/curl; the Go server itself answers /healthz so
# rely on `docker compose healthcheck` with a TCP probe instead, configured
# at the compose level.
ENTRYPOINT ["/app/auth-go"]
