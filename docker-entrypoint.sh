#!/bin/sh
set -e

DOMAIN="${SSL_DOMAIN:-localhost}"

echo "Generating self-signed certificate for: $DOMAIN"
mkdir -p /etc/nginx/ssl

# Use IP SAN for IP addresses, DNS SAN for hostnames
if echo "$DOMAIN" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
  SAN="IP:${DOMAIN},DNS:localhost,IP:127.0.0.1"
else
  SAN="DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"
fi

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/server.key \
  -out /etc/nginx/ssl/server.crt \
  -subj "/CN=${DOMAIN}" \
  -addext "subjectAltName=${SAN}"

echo "Running database migrations..."
node /app/backend/dist/migrations/migrate.js

exec /usr/bin/supervisord -c /etc/supervisord.conf
