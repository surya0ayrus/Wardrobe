# Application image:
# one container with PHP-FPM + Caddy + queue worker + scheduler, managed by Supervisor.
# The database (Postgres) and Redis are NOT part of this image; they are external
# and configured through environment variables (DB_HOST, REDIS_HOST, ...).

# ── Stage 1: PHP dependencies ─────────────────────────────────────────
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install \
    --no-dev \
    --ignore-platform-reqs \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts \
    --no-cache

# ── Stage 2: React frontend ───────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 3: Application ──────────────────────────────────────────────
FROM php:8.4-fpm-alpine

ENV PORT=8080

RUN apk add --no-cache \
    caddy \
    fcgi \
    freetype \
    icu-libs \
    libjpeg-turbo \
    libpng \
    libzip \
    postgresql-libs \
    supervisor \
    wget

RUN set -eux; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS freetype-dev icu-dev libjpeg-turbo-dev libpng-dev libzip-dev linux-headers postgresql-dev; \
    pecl install redis; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" bcmath exif gd intl opcache pcntl pdo_pgsql zip; \
    docker-php-ext-enable redis; \
    apk del .build-deps

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/opcache.ini /usr/local/etc/php/conf.d/zz-opcache.ini
COPY docker/www.conf /usr/local/etc/php-fpm.d/zz-www.conf

WORKDIR /var/www/html


COPY backend/ ./
COPY --from=vendor /app/vendor ./vendor
COPY --from=frontend /app/dist/ ./public/

RUN php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/up" || exit 1

EXPOSE ${PORT}

ENTRYPOINT ["entrypoint.sh"]
