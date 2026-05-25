# TrainingTracker — Copilot Instructions

## Project Overview

Fitness tracking PWA. Users define training sessions (exercises, sets, rest timers), run workouts in guided "training mode", and view history in a monthly calendar.

## Monorepo Structure

```
apps/
  backend/    Fastify 4 API + PostgreSQL (Node 20, TypeScript)
  frontend/   React 18 + Vite 5 + MUI v5 (TypeScript)
  e2e/        Cypress 13 E2E tests
```

**Package manager**: pnpm 10.9.0 (`"packageManager": "pnpm@10.9.0"` in root `package.json` — do not change, pnpm v11 requires Node 22).  
**Workspace pattern**: `apps/*` in `pnpm-workspace.yaml`.  
**Important**: `.npmrc` contains `node-linker=hoisted` — required because the drive is exFAT and cannot use symlinks. Never remove it.

## Commands

```bash
# Development
pnpm dev               # starts backend (tsx watch) + frontend (vite) concurrently
pnpm db:migrate        # run SQL migrations against local postgres

# Build / lint
pnpm build             # build backend (tsc) then frontend (tsc + vite build)
pnpm lint              # tsc --noEmit in all packages

# Docker
pnpm docker:up         # docker compose up --build
pnpm docker:down       # docker compose down
docker compose up -d --build app   # rebuild only the app container

# E2E
pnpm e2e:open          # Cypress GUI (requires Docker running on port 80)
pnpm e2e:run           # Cypress headless CI run
```

## Backend (apps/backend)

- **Framework**: Fastify 4, plugins in `src/plugins/` (postgres, auth)
- **Auth**: Auth0 RS256 JWT via `fastify.authenticate` preHandler — all routes except `/health` require it
- **Database**: PostgreSQL via `@fastify/postgres`; raw SQL, no ORM
- **Migrations**: `src/migrations/migrate.ts` — runs `INITIAL_MIGRATION` SQL idempotently (`IF NOT EXISTS`)

### API Routes (all prefixed `/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions` | List user's sessions (with exercises + schedule) |
| POST | `/sessions` | Create session |
| PUT | `/sessions/:id` | Update session name/description |
| DELETE | `/sessions/:id` | Delete session |
| PUT | `/sessions/:id/schedule` | Set schedule days (array of 0–6) |
| GET | `/sessions/:sessionId/exercises` | List exercises for a session |
| POST | `/sessions/:sessionId/exercises` | Add exercise to session |
| PUT | `/sessions/:sessionId/exercises/:id` | Update exercise |
| DELETE | `/sessions/:sessionId/exercises/:id` | Delete exercise |
| PUT | `/sessions/:sessionId/exercises/reorder` | Reorder exercises |
| POST | `/workouts` | Start a workout (`{ sessionId? }`) |
| GET | `/workouts` | List workouts (`?from=&to=` ISO dates) |
| POST | `/workouts/:id/sets` | Log a set (`{ exerciseId, setNumber, weightKg }`) |
| PUT | `/workouts/:id/complete` | Complete a workout — **no body, no `Content-Type` header** |
| GET | `/health` | Health check (unauthenticated) |

**Critical**: `PUT /workouts/:id/complete` takes no body. Sending `Content-Type: application/json` with an empty body causes a 400. The frontend `apiFetch` only sets `Content-Type` when `options.body !== undefined`.

## Frontend (apps/frontend)

- **Routing**: React Router v6, `BrowserRouter` wrapping `Auth0ProviderWithHistory`
- **Auth**: `@auth0/auth0-react` v2, `cacheLocation="localstorage"` — **required** for Cypress `cy.session()` to persist tokens
- **UI**: MUI v5 dark theme, mobile-first (390×844 viewport)
- **Bottom nav tabs**: Home, Sessions, Calendar, Profile
- **API layer**: `useApiClient()` hook in `src/api/client.ts` — wraps `fetch` with JWT injection

### Key components
- `src/auth/Auth0ProviderWithHistory.tsx` — must keep `cacheLocation="localstorage"`
- `src/pages/TrainingMode.tsx` — guided workout flow
- `src/components/Calendar/WorkoutCalendar.tsx` — **custom calendar, not MUI DateCalendar** — uses `Paper` cells with `data-cy="calendar-day"` / `data-cy="workout-day"`

### `data-cy` attributes (Cypress selectors)
Every interactive element used in tests has a `data-cy` attribute. When adding new testable UI, follow the same pattern. Key selectors:

| Selector | Element |
|----------|---------|
| `[data-cy="dashboard"]` | Dashboard root |
| `[data-cy="sessions-page"]` | Sessions page root |
| `[data-cy="add-session-fab"]` | Add session FAB |
| `[data-cy="start-training-btn"]` | Start training on SessionCard |
| `[data-cy="delete-session-btn"]` | Delete session on SessionCard |
| `[data-cy="session-name-input"]` | Session name TextField |
| `[data-cy="save-session-btn"]` | Save session button |
| `[data-cy="add-exercise-btn"]` | Add exercise button |
| `[data-cy="exercise-name-input"]` | Exercise name TextField |
| `[data-cy="save-exercise-btn"]` | Save exercise button |
| `[data-cy="weight-input"]` | Weight TextField in training mode |
| `[data-cy="set-done-btn"]` | Set Done button |
| `[data-cy="rest-timer"]` | Rest timer container |
| `[data-cy="skip-rest-btn"]` | Skip rest button |
| `[data-cy="workout-done"]` | Workout done screen |
| `[data-cy="logout-btn"]` | Logout button on Profile |
| `[data-cy="calendar-page"]` | Calendar page root |
| `[data-cy="calendar-day"]` | Calendar day cell (no workout) |
| `[data-cy="workout-day"]` | Calendar day cell (has workout) |

## E2E Tests (apps/e2e)

- **Base URL**: `http://localhost` (Docker stack must be running)
- **Auth**: `cy.loginAuth0()` — uses `cy.session()` + `cy.origin()` for Auth0 Universal Login; session cached across specs via `cacheAcrossSpecs: true`
- **Credentials**: stored in `apps/e2e/cypress.env.json` (git-ignored); see `cypress.env.json.example`
- **Token capture pattern**: intercept `GET /api/sessions` to extract the `Authorization` header, then use it for direct `cy.request()` API calls in `before()`/`after()` hooks
- **Controlled number inputs**: use `cy.type('{selectAll}80')` instead of `.clear().type('80')` — React resets controlled number inputs to `0` on `change` with empty value, causing `.clear().type('80')` to produce `800`

### Auth0 login — known pitfalls
- `cy.get('button[type="submit"]')` matches multiple buttons (social logins + main). Always scope: `cy.get('input[name="password"]').closest('form').find('button[type="submit"]').click()`
- `cy.url()` and `Cypress.env()` do not work inside `cy.origin()` without passing values via `args`
- Session validation checks `cy.getAllLocalStorage()` for `@@auth0spajs@@` key — avoids a `cy.visit()` that would redirect cross-origin when the token is gone

## Docker

Single `app` container: Node 20-alpine build stage → Alpine + nginx + supervisord final stage. nginx proxies `/api/*` to Fastify on port 3000; serves the Vite build for all other paths.

**Auth0 env vars** are injected at Docker build time as `ARG`/`--build-arg` (Vite bakes them into the JS bundle). They must be present in `.env` before running `docker compose up --build`.

```
# Required in .env for Docker build
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=
AUTH0_DOMAIN=
AUTH0_AUDIENCE=
```

## Environment Variables

Copy `.env.example` → `.env` and fill in Auth0 values. The file is git-ignored.  
`POSTGRES_PASSWORD` defaults to `postgres` for local development.
