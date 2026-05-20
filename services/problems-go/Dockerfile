# syntax=docker/dockerfile:1.7

# ── Stage 1: Build the static binary ─────────────────────────────────────────
FROM golang:1.22-alpine AS builder
WORKDIR /src

# Cache the module graph before copying source.
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -mod=mod \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/problems-go \
    ./cmd/server

# ── Stage 2: Minimal runtime ─────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/JasonTM17/Leetrank_Project"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app

COPY --from=builder /out/problems-go /app/problems-go

USER nonroot:nonroot
EXPOSE 4013

ENV PROBLEMS_PORT=4013

# distroless has no wget/curl; the Go binary itself answers /healthz so
# rely on `docker compose healthcheck` with the in-image binary probe.
ENTRYPOINT ["/app/problems-go"]
