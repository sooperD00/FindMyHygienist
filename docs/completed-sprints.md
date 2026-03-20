# Completed Sprints

<!-- Move sprint sections here from remaining-sprints.md as they ship.
     Include the actual date range, any deviations from plan, and
     links to relevant commits or PRs. -->

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
