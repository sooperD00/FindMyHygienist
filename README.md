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
├── .gitignore                          # - [x] Sprint 0: Python + Node combined
├── README.md
├── docs/
│   ├── architecture.md                 # - [x] init: System design, data model, API surface
│   ├── decisions.md                    # - [x] init: ADRs (architecture decision records)
│   ├── remaining-sprints.md            # - [x] init: What's next
│   └── completed-sprints.md            # - [x] init: What's done
├── backend/
│   ├── .env.example                    # - [x] Sprint 0: DATABASE_PUBLIC_URL, S3 creds, etc.
│   ├── alembic.ini                     # - [x] Sprint 0: Alembic config
│   ├── requirements.txt                # - [x] Sprint 0: pip dependencies
│   ├── requirements-dev.txt            # - [x] Sprint 1: dev dependencies (pytest)
│   ├── migrations/
│   │   └── env.py                      # - [x] Sprint 0: async Alembic setup
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # - [x] Sprint 0: FastAPI app instance, health check, router includes
│   │   ├── config.py                   # - [x] Sprint 0: Pydantic settings, reads .env
│   │   ├── database.py                 # - [x] Sprint 0: Async engine + session setup
│   │   ├── models/
│   │   │   ├── __init__.py             # - [x] Sprint 0: scaffold
│   │   │   ├── enums.py                # - [x] Sprint 1: UserRole, CredentialType, ProviderType, ProviderStatus, Availability, FeedbackType
│   │   │   ├── user.py                 # - [x] Sprint 1: User (auth identity for everyone)
│   │   │   ├── credential.py           # - [x] Sprint 1: Credential (reference table, seeded from credentials.json)
│   │   │   ├── provider.py             # - [x] Sprint 1: Provider, ProviderCredential, ProviderLocation
│   │   │   └── feedback.py             # - [x] Sprint 1: Feedback
│   │   ├── data/
│   │   │   └── credentials.json        # - [x] Sprint 1: 17 Oregon credential seed entries
│   │   ├── routes/
│   │   │   └── __init__.py             # - [x] Sprint 0: scaffold
│   │   └── services/
│   │       └── __init__.py             # - [x] Sprint 0: scaffold
│   └── tests/                          # - [ ] PyTests
└── frontend/
    ├── .gitignore                      # - [x] Sprint 0: Vite/Node defaults
    ├── index.html                      # - [x] Sprint 0: Vite entry point
    ├── package.json                    # - [x] Sprint 0: React 19, react-router-dom v7, Vite 8
    ├── vite.config.ts                  # - [x] Sprint 0: Vite proxy /api/* → localhost:8000
    ├── tsconfig.json                   # - [x] Sprint 0: TypeScript project references
    ├── tsconfig.app.json               # - [x] Sprint 0: app-level TS config
    ├── tsconfig.node.json              # - [x] Sprint 0: node-level TS config
    ├── eslint.config.js                # - [x] Sprint 0: ESLint flat config
    ├── public/                         # - [x] Sprint 0: static assets (Vite default)
    └── src/
        ├── main.tsx                    # - [x] Sprint 0: React DOM entry point
        ├── App.tsx                     # - [x] Sprint 0: top-level routing table
        ├── App.css                     # - [x] Sprint 0: app styles (Vite default, to be replaced)
        ├── index.css                   # - [x] Sprint 0: global styles (Vite default, to be replaced)
        ├── api/
        │   └── client.ts              # - [x] Sprint 0: typed API client stub (health check wired)
        ├── assets/
        │   └── hero.png               # - [x] Sprint 0: landing page hero image
        ├── components/
        │   └── Layout.tsx             # - [x] Sprint 0: shell (nav + footer) with <Outlet />
        ├── pages/
        │   ├── Home.tsx               # - [x] Sprint 0: stub
        │   ├── Search.tsx             # - [x] Sprint 0: stub
        │   ├── Profile.tsx            # - [x] Sprint 0: stub
        │   ├── About.tsx              # - [x] Sprint 0: stub
        │   ├── Join.tsx               # - [x] Sprint 0: stub
        │   ├── Login.tsx              # - [x] Sprint 0: stub
        │   ├── Dashboard.tsx          # - [x] Sprint 0: stub
        │   ├── Admin.tsx              # - [x] Sprint 0: stub
        │   └── NotFound.tsx           # - [x] Sprint 0: stub
        └── __tests__/                 # - [ ] Vitest tests
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
