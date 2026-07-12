# AI Interviewer — MERN Edition

Production-structured MERN rebuild of the AI Interviewer app: an Express 5 + MongoDB + Redis API and a React (Vite) client, replacing the Next.js/Firebase stack with self-hosted JWT authentication.

## Status

| Piece | State |
|---|---|
| Root setup (workspaces, Docker Compose, CI, editorconfig) | ✅ |
| Backend auth flow (register/login/refresh/logout, JWT + Redis) | ✅ |
| Backend interview/resume domain features | 🔜 next |
| Frontend (React/Vite/Tailwind/daisyUI) | 🔜 scaffolded workspace only |

## Architecture

```
mern-app/
├── client/   # React (Vite) frontend — feature-based structure
├── server/   # Express API — routes → controllers → services → models
└── docker-compose.yml  # api + mongo + redis for local dev
```

The server follows a strict layered architecture (see folder docs in `server/src/`): routes declare endpoints, controllers shape requests/responses, services own business logic, models are schemas only. `app.js` builds the Express app without listening; `server.js` owns process lifecycle.

## Authentication design

- **Access token** — short-lived JWT (default 15m), returned in the JSON body, sent by the client as `Authorization: Bearer`. A Redis **blocklist** (`auth:block:<jti>`) makes logout take effect immediately despite statelessness.
- **Refresh token** — long-lived JWT (default 7d) in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Redis holds the **whitelist** (`auth:refresh:<jti>` → userId).
- **Rotation & reuse detection** — every `/auth/refresh` invalidates the presented token and issues a new pair. A structurally valid refresh token that is *not* whitelisted means it was already used → all of that user's sessions are revoked.
- **Audit trail** — every refresh token is also recorded in Mongo (`Token` model, TTL-indexed) with user agent + IP, powering `/auth/logout-all` and post-incident review.
- **Rate limiting** — Redis fixed-window limiter on credential endpoints (works across instances, fails open if Redis blips).

### Endpoints (v1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register` | – | 201, sets refresh cookie |
| POST | `/api/v1/auth/login` | – | sets refresh cookie |
| POST | `/api/v1/auth/refresh` | cookie | rotates the pair |
| POST | `/api/v1/auth/logout` | Bearer | blocklists access token, revokes refresh |
| POST | `/api/v1/auth/logout-all` | Bearer | revokes every session |
| GET | `/api/v1/users/me` | Bearer | current profile |
| PATCH | `/api/v1/users/me` | Bearer | update name / avatar |

Every success response is `{ success: true, message, data }`; every error is `{ success: false, message, errors }`.

## Local development

```bash
cd mern-app
npm install                      # installs both workspaces

cp server/.env.example server/.env   # fill in the two JWT secrets
docker compose up mongo redis -d     # datastores only
npm run dev:server                   # API on :5000

# or run everything in containers:
docker compose up --build
```

Generate JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Tests

```bash
npm test --workspace server
```

Uses `node:test` — no datastore needed for the boot-level suite. CI (`.github/workflows/ci.yml`) runs lint + tests for both workspaces on every PR.
