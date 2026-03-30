"""
FastAPI app instance, router includes, middleware.

Sprint 2: auth router + CORS middleware.
Sprint 4: profile router (credentials, own profile, public profiles).
Sprint 5: photo router, location router, static file serving for dev photos.
CORS is configured now (even though Vite proxy handles dev) so it
doesn't bite us in Sprint 7 when prod needs it. See remaining-sprints.md.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routes.auth import router as auth_router
from app.routes.locations import router as location_router
from app.routes.photo import router as photo_router
from app.routes.profile import router as profile_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Oral Health Providers", lifespan=lifespan)

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
app.include_router(photo_router)
app.include_router(location_router)

# ── Static file serving (dev only) ────────────────────────────────
# In dev, serve uploaded photos from the local filesystem.
# In prod, photos are served directly from S3/CDN (Sprint 12).
if settings.debug:
    upload_path = Path(settings.photo_upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    app.mount(
        "/uploads",
        StaticFiles(directory=str(upload_path)),
        name="uploads",
    )


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
