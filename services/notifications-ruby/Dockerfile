# syntax=docker/dockerfile:1.7

# Stage 1: bundler
FROM ruby:3.3-alpine AS builder
WORKDIR /app

RUN apk add --no-cache build-base linux-headers

COPY Gemfile ./
RUN bundle config set --local without 'development test' && \
    bundle config set --local path 'vendor/bundle' && \
    bundle install --jobs=4 --retry=3

COPY . .

# Stage 2: runtime — alpine for the 1MB SMTP/Net::HTTP delta over distroless.
FROM ruby:3.3-alpine AS runtime

ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/JasonTM17/Leetrank_Project"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.revision="$COMMIT_SHA"

WORKDIR /app

RUN apk add --no-cache tini ca-certificates && \
    addgroup -S app && adduser -S -G app app

ENV BUNDLE_PATH=/app/vendor/bundle \
    BUNDLE_WITHOUT="development:test" \
    RACK_ENV=production \
    PORT=4015

COPY --from=builder --chown=app:app /app /app

USER app
EXPOSE 4015

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget --quiet --spider http://localhost:4015/v1/notifications/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
