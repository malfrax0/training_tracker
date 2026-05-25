# Training Tracker

A self-hosted fitness tracker built as a PNPM monorepo, designed to run on a NAS or any Docker-capable host.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Tech Stack](#tech-stack)
3. [Environment Variables](#environment-variables)
4. [Auth0 Setup](#auth0-setup)
5. [Local Development](#local-development)
6. [Docker / NAS Deployment](#docker--nas-deployment)
7. [API Reference](#api-reference)
8. [Database Schema](#database-schema)

---

## Project Structure

```
TrainingTracker/
├── apps/
│   ├── backend/          Node.js + Fastify REST API
│   │   └── src/
│   │       ├── config/       Environment validation
│   │       ├── migrations/   SQL schema (auto-applied on startup)
│   │       ├── plugins/      Fastify plugins (postgres, auth)
│   │       ├── routes/       REST endpoints
│   │       └── types/        TypeScript types
│   └── frontend/         React + Vite + MUI SPA
│       └── src/
│           ├── api/          Typed fetch wrappers
│           ├── auth/         Auth0 provider
│           ├── components/   Reusable UI components
│           ├── hooks/        Custom React hooks
│           ├── pages/        Route-level page components
│           └── types/        Shared TypeScript types
├── nginx/nginx.conf      Nginx config (serves frontend + proxies /api)
├── supervisord.conf      Runs nginx + node in a single container
├── docker-compose.yml    Orchestrates app + postgres
├── Dockerfile            Multi-stage build
└── doc/README.md         This file
```

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Monorepo   | PNPM workspaces                     |
| Frontend   | React 18, Vite, TypeScript, MUI v5  |
| Backend    | Node 20, Fastify 4, TypeScript      |
| Database   | PostgreSQL 16                       |
| Auth       | Auth0 (SPA + JWT verification)      |
| Container  | Docker (supervisord: nginx + node)  |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values.

### Backend variables

| Variable         | Description                                         | Required |
|-----------------|-----------------------------------------------------|----------|
| `DATABASE_URL`  | PostgreSQL connection string                        | Yes      |
| `AUTH0_DOMAIN`  | Auth0 tenant domain (e.g. `dev-xxx.auth0.com`)     | Yes      |
| `AUTH0_AUDIENCE`| API audience identifier (e.g. `https://training-tracker/api`) | Yes |
| `CORS_ORIGIN`   | Allowed CORS origin (`*` in production via nginx)   | No       |
| `PORT`          | Backend port (default: `3000`)                      | No       |
| `NODE_ENV`      | `development` or `production`                       | No       |

### Frontend variables (Vite — embedded at build time)

| Variable               | Description                              |
|------------------------|------------------------------------------|
| `VITE_AUTH0_DOMAIN`    | Auth0 tenant domain                      |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA client ID                      |
| `VITE_AUTH0_AUDIENCE`  | Must match backend `AUTH0_AUDIENCE`      |

### Docker Compose variables

| Variable            | Default              |
|--------------------|----------------------|
| `POSTGRES_DB`      | `training_tracker`   |
| `POSTGRES_PASSWORD`| `postgres`           |
| `APP_PORT`         | `80`                 |

---

## Auth0 Setup

1. Log in to [Auth0 Dashboard](https://manage.auth0.com).
2. **Create an Application** → Single Page Application → name it `Training Tracker`.
   - Set **Allowed Callback URLs**: `http://localhost:5173, https://your-nas-ip`
   - Set **Allowed Logout URLs**: `http://localhost:5173, https://your-nas-ip`
   - Set **Allowed Web Origins**: `http://localhost:5173, https://your-nas-ip`
   - Copy **Client ID** → `VITE_AUTH0_CLIENT_ID`
3. **Create an API** → identifier `https://training-tracker/api` → Algorithm RS256.
   - Copy the identifier → `AUTH0_AUDIENCE` and `VITE_AUTH0_AUDIENCE`
4. Copy your **Domain** → `AUTH0_DOMAIN` and `VITE_AUTH0_DOMAIN`.

---

## Local Development

### Prerequisites

- Node.js 20+
- PNPM (`npm install -g pnpm`)
- PostgreSQL running locally (or Docker)

### Steps

```bash
# 1. Clone and install
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in all values in .env

# 3. Start both servers in watch mode
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- API calls from the frontend are proxied by Vite to the backend automatically.

### Individual workspace commands

```bash
pnpm --filter backend dev       # backend only
pnpm --filter frontend dev      # frontend only
pnpm --filter backend lint      # type-check backend
pnpm --filter frontend lint     # type-check frontend
pnpm build                      # build both for production
pnpm db:migrate                 # run migrations manually
```

---

## Docker / NAS Deployment

### Architecture

The Docker image packages nginx and the Node.js backend into a single container managed by **supervisord**. PostgreSQL runs as a separate container.

```
[Browser] → :80 → [nginx]
                    ├── /         → /usr/share/nginx/html (React SPA)
                    ├── /api/*    → http://127.0.0.1:3000 (Fastify)
                    └── /health   → http://127.0.0.1:3000 (Fastify)
```

### Steps

```bash
# 1. Copy and fill in .env
cp .env.example .env

# 2. Build and start
pnpm docker:up
# or: docker-compose up --build -d

# 3. Check logs
pnpm docker:logs

# 4. Stop
pnpm docker:down
```

### NAS (Synology / QNAP / Unraid)

1. Transfer the project directory to your NAS.
2. Ensure Docker and Docker Compose are installed.
3. Fill in `.env` with your Auth0 credentials and desired `APP_PORT`.
4. Run `docker-compose up -d --build`.
5. Add Auth0 allowed origins/callbacks for your NAS IP/hostname.

### Port mapping

Change `APP_PORT` in `.env` to expose on a different port:
```
APP_PORT=8080
```

---

## API Reference

All endpoints except `/health` require a valid Auth0 Bearer token.

```
Authorization: Bearer <access_token>
```

### Health

```
GET /health
→ { status: "ok", database: "connected" }
```

### Sessions

| Method | Path                          | Description                         |
|--------|-------------------------------|-------------------------------------|
| GET    | `/api/sessions`               | List all sessions (with exercises)  |
| GET    | `/api/sessions/:id`           | Get a single session                |
| POST   | `/api/sessions`               | Create a session                    |
| PUT    | `/api/sessions/:id`           | Update name/description             |
| DELETE | `/api/sessions/:id`           | Delete a session                    |
| PUT    | `/api/sessions/:id/schedules` | Replace recurring schedule days     |

### Exercises

| Method | Path                                          | Description             |
|--------|-----------------------------------------------|-------------------------|
| GET    | `/api/sessions/:sessionId/exercises`          | List exercises          |
| POST   | `/api/sessions/:sessionId/exercises`          | Add exercise            |
| PUT    | `/api/exercises/:id`                          | Update exercise         |
| DELETE | `/api/exercises/:id`                          | Delete exercise         |
| PUT    | `/api/sessions/:sessionId/exercises/reorder`  | Reorder exercises       |

### Workouts

| Method | Path                         | Description                          |
|--------|------------------------------|--------------------------------------|
| POST   | `/api/workouts`              | Start a workout                      |
| GET    | `/api/workouts`              | List workouts (`?from=&to=` filters) |
| GET    | `/api/workouts/:id`          | Get workout with sets                |
| PUT    | `/api/workouts/:id/complete` | Mark as fully completed              |
| PUT    | `/api/workouts/:id/finish`   | Mark as finished (partial)           |
| POST   | `/api/workouts/:id/sets`     | Log a completed set                  |

---

## Database Schema

```sql
users              (id VARCHAR PK, created_at)
sessions           (id UUID PK, user_id, name, description, created_at, updated_at)
session_schedules  (session_id, day_of_week [0=Mon … 6=Sun])
exercises          (id UUID PK, session_id, name, description, nb_series, 
                    default_weight_kg, rest_timer_seconds, sort_order)
workout_logs       (id UUID PK, user_id, session_id, started_at, finished_at, is_complete)
workout_set_logs   (id UUID PK, workout_log_id, exercise_id, set_number, weight_kg, done_at)
```

Migrations are applied automatically when the backend starts.
