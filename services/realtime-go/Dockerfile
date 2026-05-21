# syntax=docker/dockerfile:1.7

# Stage 1: build
FROM golang:1.23-alpine AS builder
WORKDIR /src

COPY go.mod ./
COPY go.sum* ./
RUN go mod download || go mod tidy

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -mod=mod \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/realtime-go \
    ./cmd/server

# Stage 2: runtime
FROM gcr.io/distroless/static-debian12:nonroot

ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/JasonTM17/Leetrank_Project"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app

COPY --from=builder /out/realtime-go /app/realtime-go

USER nonroot:nonroot
EXPOSE 4017
ENV REALTIME_PORT=4017

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/app/realtime-go", "-healthcheck"]

ENTRYPOINT ["/app/realtime-go"]
