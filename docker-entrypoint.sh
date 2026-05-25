#!/bin/sh
set -e

DOMAIN="${SSL_DOMAIN:-localhost}"

echo "Generating self-signed certificate for: $DOMAIN"
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/server.key \
  -out /etc/nginx/ssl/server.crt \
  -subj "/CN=${DOMAIN}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"

exec /usr/bin/supervisord -c /etc/supervisord.conf
