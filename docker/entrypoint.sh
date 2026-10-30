#!/bin/sh
# Runs every time the container starts, then hands over to Supervisor.
set -e

cd /var/www/html

# Runtime folders (storage may be an empty mounted volume).
mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache storage/app/public storage/logs

# Public link for uploaded files.
php artisan storage:link --force >/dev/null 2>&1 || true

echo "Running migrations..."
php artisan migrate --force

# Adds any new permissions from config/permissions.php (safe to run every time).
echo "Syncing permissions..."
php artisan db:seed --class=PermissionSeeder --force

echo "Caching configuration, routes and views..."
php artisan optimize

# Artisan ran as root: give the files back to the web user.
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

echo "Starting Supervisor (PHP-FPM, Caddy, queue worker, scheduler)..."
exec supervisord -c /etc/supervisord.conf
