"""
Session lifecycle: create, look up, delete.

Sessions live in Postgres (ADR-006). Each row is one active login.
Logout = DELETE the row. No blacklist, no cleanup cron — the whitelist
model means a session exists if and only if the user is logged in.

Expired sessions are cleaned up lazily: get_session checks expiry and
deletes stale rows on read. A periodic cleanup can be added later if
the table grows, but at OHP's scale it won't.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.session import Session


async def create_session(db: AsyncSession, user_id: uuid.UUID) -> Session:
    """Create a new session row. Returns the Session (caller sets cookies).

    Generates both the session ID and the CSRF synchronizer token here —
    one creation point, both tokens born together.
    """
    now = datetime.now(timezone.utc)
    session = Session(
        id=secrets.token_urlsafe(32),
        user_id=user_id,
        csrf_token=secrets.token_urlsafe(32),
        created_at=now,
        expires_at=now + timedelta(hours=settings.session_lifetime_hours),
    )
    db.add(session)
    await db.flush()
    return session


async def get_session(db: AsyncSession, session_id: str) -> Session | None:
    """Look up a session by ID. Returns None if missing or expired.

    Lazy cleanup: if the session has expired, delete it on the spot
    rather than leaving a stale row for a cron to find.
    """
    session = await db.get(Session, session_id)
    if session is None:
        return None
    if session.expires_at < datetime.now(timezone.utc):
        await db.delete(session)
        await db.flush()
        return None
    return session


async def delete_session(db: AsyncSession, session_id: str) -> bool:
    """Delete a session (logout). Returns True if a row was actually removed."""
    session = await db.get(Session, session_id)
    if session is None:
        return False
    await db.delete(session)
    await db.flush()
    return True
