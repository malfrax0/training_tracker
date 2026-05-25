# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE

ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN pnpm install --frozen-lockfile

COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

RUN pnpm --filter backend build
RUN pnpm --filter frontend build
RUN pnpm --filter backend --prod deploy --legacy /prod/backend

# ─── Final image ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS final

RUN apk add --no-cache nginx supervisor openssl

RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/server.key \
      -out /etc/nginx/ssl/server.crt \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

COPY --from=build /prod/backend /app/backend
COPY --from=build /app/apps/backend/dist /app/backend/dist
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 80 443

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
