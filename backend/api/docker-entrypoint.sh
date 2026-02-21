#!/bin/sh
set -e

if [ -z "$APP_USER" ]; then
    echo "APP_USER not set"
    exit 1
fi

# Set ownership of mounted storage
if [ -d "/app/storage" ]; then
    chown -R "$APP_USER:$APP_USER" /app/storage || true
fi

exec su "$APP_USER" -c "$@"
