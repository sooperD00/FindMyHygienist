"""
Pydantic settings, reads .env (single source of truth)
(no defaults / silent fallbacks — except where noted)

Sprint 2 additions: session_lifetime_hours, debug, cors_origins,
admin_password. The admin_password is only needed when running
`python -m app.seed` — it's not read at app startup.
"""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(alias="DATABASE_PUBLIC_URL")
    secret_key: str
    admin_email: str
    auto_approve: bool

    # Session config (ADR-006)
    session_lifetime_hours: int = Field(default=168)  # 7 days

    # Controls cookie Secure flag. True in prod (HTTPS required),
    # False in dev so localhost works without certs.
    debug: bool = Field(default=False)

    # Cookie domain for cross-subdomain sharing in prod
    # (e.g., ".findmyhygienist.org" not hardcoded). None in dev = browser defaults to current host.
    cookie_domain: str | None = Field(default=None)

    # Local filesystem path for photo uploads in dev (Sprint 5).
    # Ignored in prod — S3 backend uses bucket config instead (Sprint 12).
    photo_upload_dir: str = Field(default="./uploads")

    # Comma-separated allowed origins for CORS, e.g.
    # "http://localhost:5173,https://findmyhygienist.org"
    # Empty string = CORS middleware not added (Vite proxy handles dev).
    cors_origins: str = Field(default="")

    # Only needed for `python -m app.seed` to create admin user.
    # Not required at app startup — defaults to None.
    admin_password: str | None = Field(default=None)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
