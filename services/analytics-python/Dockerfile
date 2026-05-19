# syntax=docker/dockerfile:1.7

# Stage 1: build wheels
FROM python:3.13-slim AS builder
WORKDIR /build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip wheel --wheel-dir=/wheels -r requirements.txt

# Stage 2: minimal runtime
FROM python:3.13-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ANALYTICS_PORT=4016

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app

COPY --from=builder /wheels /wheels
COPY requirements.txt ./
RUN pip install --no-index --find-links=/wheels -r requirements.txt && rm -rf /wheels

COPY app ./app
RUN chown -R app:app /app

USER app
EXPOSE 4016

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -fsS http://localhost:4016/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4016"]
