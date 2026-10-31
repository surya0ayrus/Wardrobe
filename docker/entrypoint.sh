#!/bin/sh
# Runs every time the container starts, then hands over to Supervisor.
set -e
cd /app

echo "Running migrations..."
alembic upgrade head

# Adds any new permissions from app/permissions_config.py (safe to run every time).
echo "Syncing permissions..."
python -m app.seed permissions

echo "Starting Supervisor (API, Caddy)..."
exec supervisord -c /etc/supervisord.conf
