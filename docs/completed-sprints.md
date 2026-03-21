# Completed Sprints

<!-- Move sprint sections here from remaining-sprints.md as they ship.
     Include the actual date range, any deviations from plan, and
     links to relevant commits or PRs. Latest sprints are at the top. -->


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
