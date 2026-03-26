"""
Server-side session — one row per active login.

The session ID is an opaque token (secrets.token_urlsafe) stored in an
HTTP-only secure cookie. The csrf_token is the synchronizer token for
CSRF protection (ADR-006): stored server-side, delivered to the browser
via a JS-readable cookie, and validated against the DB value on every
state-changing request.

Synchronizer token pattern (not double-submit):
  - Source of truth is the csrf_token column in this table
  - The csrf_token cookie is just a delivery mechanism for the frontend
  - Validation compares the X-CSRF-Token header to the DB value
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, SQLModel


class Session(SQLModel, table=True):
    __tablename__ = "sessions"

    # Opaque token — secrets.token_urlsafe(32) produces 43 chars
    id: str = Field(primary_key=True, max_length=64)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    csrf_token: str = Field(max_length=64)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), nullable=False
        ),
    )
    # No server_default — application code must set this explicitly.
    # (datetime | None so Python doesn't complain before the object is
    # flushed to the DB; the column itself is NOT NULL.)
    expires_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
