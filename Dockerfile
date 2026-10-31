# Application image: one container with the Python API (uvicorn) + Caddy, managed by Supervisor.
# The database (Postgres) and Redis are NOT part of this image; they are external
# and configured through environment variables (DB_HOST, REDIS_HOST, ...).

# ── Stage 1: React frontend ───────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Application ──────────────────────────────────────────────
FROM python:3.12-alpine

ENV PORT=8080 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

RUN apk add --no-cache caddy supervisor wget

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/dist/ ./public/

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/up" || exit 1

EXPOSE ${PORT}

ENTRYPOINT ["entrypoint.sh"]
