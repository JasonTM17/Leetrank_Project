# ── Stage 1: Build the Go binary ─────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /build

# Copy module files; regenerate go.sum hashes via `go mod tidy` so the
# build is robust against checksum drift between local and CI Go versions.
COPY go.mod go.sum ./
RUN go mod tidy && go mod download

# Source files for the multi-file judge package.
COPY main.go languages.go exec.go scheduler.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o judge-service .

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install language runtimes and utilities. One big RUN to keep layers small.
# Languages shipped (per languages.json):
#   scripting   — python3, ruby, php, bash, lua5.4, perl, elixir, typescript (tsx)
#   compiled    — go, rust, c (gcc), c++ (g++), c# (mono), d (gdc), pascal (fpc),
#                 nim, fortran (gfortran)
#   jvm         — java, kotlin, scala, groovy, clojure
#   functional  — haskell (ghc), ocaml, racket, common-lisp (sbcl), erlang, fsharp
#   data        — sql (sqlite3), r, julia
#   esoteric    — tcl, awk (gawk)
# Deferred (toolchain too heavy or needs external apt repo):
#   swift   — needs packages.swift.org apt key; ~600 MB runtime
#   dart    — needs Google apt key (dl.google.com/linux/dart/deb)
#   .NET 8  — needs packages.microsoft.com; ~700 MB. csharp/fsharp use Mono today.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    golang-go \
    python3 \
    python3-pip \
    ruby \
    php-cli \
    bash \
    sqlite3 \
    gcc \
    g++ \
    gdc \
    gfortran \
    fpc \
    nim \
    rustc \
    cargo \
    default-jdk \
    kotlin \
    mono-mcs \
    mono-runtime \
    fsharp \
    groovy \
    clojure \
    ghc \
    ocaml \
    racket \
    sbcl \
    erlang \
    julia \
    r-base \
    lua5.4 \
    perl \
    scala \
    elixir \
    tcl \
    gawk \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g tsx@^4 \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled Go binary.
COPY --from=builder /build/judge-service .

# Copy runner scripts.
COPY runners/ ./runners/

# Copy the language registry — main.go loads it from disk at startup.
COPY languages.json ./

# Make runner scripts executable.
RUN chmod +x ./runners/python_runner.py \
              ./runners/ruby_runner.rb \
              ./runners/js_runner.js \
              ./runners/bash_runner.sh

# Non-root user for security.
RUN useradd -m -u 1001 judge
USER judge

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

CMD ["./judge-service"]
