"""
FastAPI dependencies for auth and authorization:
require_admin
    └── csrf_protect
            └── get_current_user
                    └── get_session (DB connection)

These are Depends() callables that read the session cookie, load the
user, validate the CSRF synchronizer token, and enforce role checks.
Routes declare which dependency they need:

    GET  endpoints needing auth → Depends(get_current_user)
    POST/PUT/DELETE needing auth → Depends(csrf_protect)
    Admin-only endpoints         → Depends(require_admin)

Why dependencies instead of middleware:
    The sprint plan says "CSRF middleware" and "Auth middleware"
    conceptually. The implementation uses FastAPI's dependency injection
    because (a) the CSRF check needs the session row that get_current_user
    already loaded — sharing via request.state avoids a second DB hit,
    and (b) dependencies participate in OpenAPI/Swagger docs so the
    lock icon shows up on protected routes. Same protection, better
    ergonomics and zero wasted queries.
"""

import secrets as secrets_mod

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.enums import UserRole
from app.models.user import User
from app.services import session_service, profile_service
from app.models.provider import Provider


# LEARN: dependency that degrades gracefully pattern
# get_current_user -> strict (401 or user)
# get_current_user_or_none  -> wrap strict function and return None instead of raising (DRY)
async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_session)
) -> User:
    """Read session_id cookie → look up session → load User.

    Caches the Session object on request.state.auth_session so
    csrf_protect can read the csrf_token without a second DB hit.
    """
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await session_service.get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    # Stash for CSRF validation downstream
    request.state.auth_session = session

    user = await db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


async def get_current_user_or_none(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> User | None:
    """Behave differently if logged in but don't require it.
    Uses existing auth dependency but swallows the 401.

    try to read the session cookie, return the user if logged in,
    return None if not.
    
    The endpoint stays unauthenticated. Field gets populated if auth present.
    """
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


async def csrf_protect(
    request: Request, user: User = Depends(get_current_user)
) -> User:
    """Validate the synchronizer CSRF token on state-changing requests.

    Compares the X-CSRF-Token header against the csrf_token stored in
    the session row — NOT against the cookie (that would be the weaker
    double-submit pattern). Uses secrets.compare_digest for timing-safe
    comparison so an attacker can't byte-at-a-time the token.
    """
    session = request.state.auth_session
    csrf_header = request.headers.get("x-csrf-token", "")

    if not csrf_header or not secrets_mod.compare_digest(
        csrf_header, session.csrf_token
    ):
        raise HTTPException(status_code=403, detail="CSRF token missing or invalid")

    return user


async def require_admin(user: User = Depends(csrf_protect)) -> User:
    """Require ADMIN role. Inherits auth + CSRF from csrf_protect.

    Used on /api/admin/* routes. A provider hitting an admin endpoint
    gets 403, not 401 — they're authenticated, just not authorized.
    """
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def _resolve_provider(user: User, db: AsyncSession) -> Provider:
    """Shared logic for both provider dependencies."""
    provider = await profile_service.get_provider_by_user_id(db, user.id)
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail="No provider profile linked to this account",
        )
    return provider


async def get_current_provider(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Provider:
    """For GET endpoints — auth check, no CSRF."""
    return await _resolve_provider(user, db)


async def get_current_provider_csrf(
    user: User = Depends(csrf_protect),
    db: AsyncSession = Depends(get_session),
) -> Provider:
    """For POST/PUT/DELETE — auth + CSRF check."""
    return await _resolve_provider(user, db)