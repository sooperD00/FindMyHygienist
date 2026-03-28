"""
FastAPI app instance, router includes, middleware.

Sprint 2: auth router + CORS middleware.
Sprint 4: profile router (credentials, own profile, public profiles).
CORS is configured now (even though Vite proxy handles dev) so it
doesn't bite us in Sprint 7 when prod needs it. See remaining-sprints.md.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routes.auth import router as auth_router
from app.routes.profile import router as profile_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="OHP — Oral Health Providers", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────
# allow_credentials=True is required for cookie-based auth — without
# it the browser won't send or accept Set-Cookie across origins.
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ── Routers ───────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(profile_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
