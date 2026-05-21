# syntax=docker/dockerfile:1.7

# Stage 1: build the static binary
FROM rust:1.90-bookworm AS builder
WORKDIR /src

# Cache dependencies — Cargo.toml declares both [lib] and [[bin]],
# so the prefetch stub needs both src/main.rs AND src/lib.rs.
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && \
    echo "fn main(){}" > src/main.rs && \
    echo "" > src/lib.rs && \
    cargo build --release && \
    rm -rf src target/release/deps/leaderboard_rust*

COPY . .
RUN cargo build --release --bin leaderboard-rust

# Stage 2: minimal runtime
FROM gcr.io/distroless/cc-debian12:nonroot

ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/JasonTM17/Leetrank_Project"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app

COPY --from=builder /src/target/release/leaderboard-rust /app/leaderboard-rust

USER nonroot:nonroot
EXPOSE 4014
ENV LEADERBOARD_PORT=4014

ENTRYPOINT ["/app/leaderboard-rust"]
