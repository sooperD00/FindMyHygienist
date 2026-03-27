# Completed Sprints

<!-- Move sprint sections here from remaining-sprints.md as they ship.
     Include the actual date range, any deviations from plan, and
     links to relevant commits or PRs. Latest sprints are at the top. -->

---


## Sprint 2 — Auth & Registration — Backend (Days 3-8) - DONE 3/26/2026 9:52p

**Goal:** A provider can register, log in, and exist in the database with a status. Backend fully testable via Swagger / curl before frontend work begins.

- [x] Finalize auth approach (ADR-006) — session-based with server-side Postgres sessions
- [x] `sessions` table migration (id, user_id, created_at, expires_at) + model
- [x] Session service: create_session, get_session, delete_session (~50–60 lines)
- [x] Auth dependency: read session cookie → look up session → load User (replaces FastAPI's `OAuth2PasswordBearer` pattern)
- [x] CSRF middleware: synchronizer token pattern for state-changing requests (POST/PUT/DELETE) -> changed to use FastAPI Depends() dependency injection so the DB hit is only 1x, but same result and added OpenAPI perk (lock icon showing up on protected routes in Swagger).
- [x] add len(password) >= 8 requirement per NIST guidelines to code and fancier password rules ambitions to housekeeping, plus a pytest for this (+2)
- [x] `POST /api/auth/register` — create User (role=PROVIDER) + Provider (status=PENDING) in one transaction, auto-login (create session + set cookie)
- [x] `POST /api/auth/login` — verify argon2id hash, create session, set HTTP-only secure cookie
- [x] `POST /api/auth/logout` — delete session row, clear cookie
- [x] `GET /api/auth/me` — return current User (id, email, role) + linked Provider id
- [x] Auth middleware: protect `/api/me/*` and `/api/admin/*` routes
- [x] Admin check: `User.role == ADMIN` (ADR-009)
- [x] Create Nicole's admin User record (seed or CLI command)
- [x] CORS middleware on FastAPI (Vite proxy covers dev, but prod needs it — do it now so it doesn't bite us in Sprint 7)

---

## Sprint 1 — Data Models & First Migration (Day 2) - DONE 3/20/2026 11:28a - 10:56p

**Goal:** All six tables exist in the database, credential seed data is loaded, Alembic is wired up and proven.

- [x] Enum definitions: `UserRole`, `CredentialType`, `ProviderType`, `ProviderStatus`, `Availability`, `FeedbackType`
- [x] SQLModel models: `User`, `Credential`, `Provider`, `ProviderCredential`, `ProviderLocation`, `Feedback`
- [x] `credentials.json` seed file (17 Oregon credential entries, ported from oral-health-providers)
- [x] Seed script or Alembic data migration to load credentials into Credential table
- [x] Uncomment model imports in `migrations/env.py`
- [x] Generate and apply first Alembic migration
- [x] Verify tables + seed data in Railway Postgres

---

## Sprint 0 — Repo & Infrastructure (Day 1) - DONE 3/19/2026 11:14a - 4:55p

**Goal:** `git init` to `npm run dev` + `uvicorn` both running, talking to each other, connected to a real database.

- [x] Initialize monorepo: `frontend/` (Vite + React + TypeScript) and `backend/` (FastAPI + SQLModel)
- [x] Vite proxy config: `/api/*` → `localhost:8000`
- [x] Backend: FastAPI app skeleton, config/env loading, database connection to Railway Postgres
- [x] Frontend: React Router v7 setup, page stubs (Home, Search, Profile, Join, Login, Dashboard, Admin, About)
- [x] Confirm frontend ↔ backend round-trip with a health-check endpoint
- [x] `.gitignore`, `.env.example`, basic README updates

**Commit 0:** Dependencies — `requirements.txt`, `package.json`. Nicole runs installs.

---
