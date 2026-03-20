# OHP — Oral Health Providers

**A directory for Oregon's oral health providers, built so the people who take care of your teeth can show you who they are.**

OHP is modeled after [Psychology Today's therapist directory](https://www.psychologytoday.com/us/therapists) — a searchable, browsable listing where dental hygienists and other oral health providers create profiles, share their credentials, and connect with patients who need them. Providers sign up, tell their story, and go live. Patients search by location, filter by what matters to them, and find someone nearby.

This is an Oregon-specific project in partnership with the [Oregon Dental Hygienists' Association](https://www.odha.org/) (ODHA). Free to list through July 2026.

## Tech Stack

| Layer | Tool |
|-------|------|
| Backend | FastAPI, SQLModel, asyncpg |
| Frontend | React, TypeScript, Vite |
| Database | PostgreSQL (Railway) |
| Image Storage | S3-compatible object storage (DO Spaces or Cloudflare R2) |
| Auth | TBD — session-based or JWT, decided in Sprint 1 |
| Deployment | Railway and/or DigitalOcean App Platform |

Monorepo: `frontend/` and `backend/` at the root.

## Quick Start

```bash
# Clone
git clone https://github.com/your-username/ohp-app.git
cd ohp-app

# Backend
cd backend
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, S3 creds, etc.
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Project Structure

> `[x]` = implemented and on disk. `[ ]` = planned — the file doesn't exist yet but its location is part of the design. This tree is both a map and a roadmap.

```
ohp-app/
├── README.md
├── docs/
│   ├── architecture.md         # - [x] init: System design, data model, API surface
│   ├── decisions.md            # - [x] init: ADRs (architecture decision records)
│   ├── remaining-sprints.md    # - [x] init: What's next
│   └── completed-sprints.md    # - [x] init: What's done
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # - [x] Sprint 0: FastAPI app instance, router includes
│   │   ├── config.py               # - [x] Sprint 0: Pydantic settings, reads .env
│   │   ├── database.py             # - [x] Sprint 0: Async engine + session setup
│   │   ├── models/
│   │   │   └── __init__.py         # - [x] Sprint 0: scaffold
│   │   ├── routes/
│   │   │   └── __init__.py         # - [x] Sprint 0: scaffold
│   │   ├── services/
│   │   │   └── __init__.py         # - [x] Sprint 0: scaffold
│   │   └── config.py
│   ├── .env                        # - [x] Sprint 0: .gitignored
│   ├── .env.example                # - [x] Sprint 0: DATABASE_PUBLIC_URL, S3 creds, etc
│   ├── alembic.ini                 # - [x] Sprint 0: config almebic
│   ├── migrations/
│   │   ├── env.py                  # - [x] Sprint 0: config alembic
│   ├── requirements.txt                 # - [x] Sprint 0: basic requirements
│   └── tests/                      # - [ ] PyTests
└── frontend/
    ├── src/
    │   ├── __tests__               # - [ ] vite tests
    │   ├── App.tsx                 # - [x] Sprint 0: replace the Vite default
    │   ├── api/
    │   │   └── client.ts           # - [x] Sprint 0: stub: typed API functions for endpoints
    │   ├── components/
    │   │   └── Layout.tsx          # - [x] Sprint 0: shell (nav and footer) / layout route with <Outlet />
    │   └── pages/
    │       ├── Home.tsx            # - [x] Sprint 0: stub
    │       ├── Search.tsx          # - [x] Sprint 0: stub
    │       ├── Profile.tsx         # - [x] Sprint 0: stub
    │       ├── About.tsx           # - [x] Sprint 0: stub
    │       ├── Join.tsx            # - [x] Sprint 0: stub
    │       ├── Login.tsx           # - [x] Sprint 0: stub
    │       ├── Dashboard.tsx       # - [x] Sprint 0: stub
    │       ├── Admin.tsx           # - [x] Sprint 0: stub
    │       └── NotFound.tsx        # - [x] Sprint 0: stub
    │   ├── package.json
    │   └── vite.config.ts          # - [x] Sprint 0: Vite proxy so FE can hit FastAPI BE
```

## Docs

- **[Architecture](docs/architecture.md)** — how the system fits together, data model, API routes, frontend pages
- **[Decisions](docs/decisions.md)** — ADRs: what we chose and why
- **[Sprint Plan](docs/remaining-sprints.md)** — what's left to build
- **[Completed Sprints](docs/completed-sprints.md)** — what's shipped

## Target Milestones

- **April 10, 2026** — ODHA conference demo. Providers can sign up, see their profile, search the directory. Admin approval flow operational.
- **May 2026** — Backup conference date if needed; ODHA outreach channel regardless.
- **July 2026** — End of free listing period; $15/month subscription begins for interested providers.

## License

TBD
