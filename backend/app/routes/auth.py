"""
Auth endpoints: register, login, logout, me.

Register and login create a session and set two cookies:
  - session_id: HTTP-only, Secure, SameSite=Lax — the auth credential,
    invisible to JavaScript.
  - csrf_token: NOT HTTP-only (JS must read it), Secure, SameSite=Lax —
    the delivery mechanism for the synchronizer token. The frontend reads
    this cookie and sends it back as X-CSRF-Token on POST/PUT/DELETE.

The csrf_token cookie is NOT the source of truth — the session row in
Postgres is. See ADR-006 and dependencies.py.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.config import settings
from app.database import get_session
from app.dependencies import csrf_protect, get_current_user
from app.models.enums import ProviderType, UserRole
from app.models.provider import Provider
from app.models.user import User
from app.services import auth_service, session_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Request / Response schemas ────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    provider_type: ProviderType


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: str


class MeResponse(BaseModel):
    user: UserResponse


# ── Cookie helpers ────────────────────────────────────────────────


def _set_session_cookies(response: Response, session) -> None:
    """Set both session_id (HTTP-only) and csrf_token (JS-readable)."""
    secure = not settings.debug
    samesite = "lax"
    max_age = settings.session_lifetime_hours * 3600

    response.set_cookie(
        key="session_id",
        value=session.id,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key="csrf_token",
        value=session.csrf_token,
        httponly=False,  # JS needs to read this
        secure=secure,
        samesite=samesite,
        max_age=max_age,
        path="/",
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie("session_id", path="/")
    response.delete_cookie("csrf_token", path="/")


# ── Endpoints ─────────────────────────────────────────────────────


@router.post("/register", response_model=MeResponse)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_session),
):
    """Create User (role=PROVIDER) + Provider in one transaction, auto-login.

    No CSRF check — there's no session to protect yet. The session and
    CSRF token are created here as part of the auto-login.
    """
    try:
        user, provider = await auth_service.register_provider(
            db=db,
            email=body.email,
            password=body.password,
            display_name=body.display_name,
            provider_type=body.provider_type,
        )
    except ValueError as e:
        # 422=validation error (short password)
        # 409="Conflict" (usually because "that email is already registered")
        # FE can catch and show "an account with this email already exists" or "Password must be at least 8 characters"
        status = 409 if "already registered" in str(e) else 422
        raise HTTPException(status_code=status, detail=str(e))

    session = await session_service.create_session(db, user.id)
    await db.commit()

    _set_session_cookies(response, session)

    return MeResponse(
        user=UserResponse(
            id=str(user.id), email=user.email, role=user.role.value
        ),
    )


@router.post("/login", response_model=MeResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_session),
):
    """Verify credentials, create session, set cookies.

    No CSRF check — same reason as register: no session exists yet.
    """
    user = await auth_service.authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session = await session_service.create_session(db, user.id)
    await db.commit()

    _set_session_cookies(response, session)

    return MeResponse(
        user=UserResponse(
            id=str(user.id), email=user.email, role=user.role.value
        ),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    _user: User = Depends(csrf_protect),  # triggers auth + CSRF; value unused
    db: AsyncSession = Depends(get_session),
):
    """Delete session row, clear cookies.

    CSRF-protected — without this, a malicious page could POST here
    and log the provider out. Low-severity but correct to prevent.
    """
    session_id = request.cookies.get("session_id")
    if session_id:
        await session_service.delete_session(db, session_id)
    await db.commit()

    _clear_session_cookies(response)
    return {"detail": "Logged out"}


@router.get("/me", response_model=MeResponse)
async def me(
    user: User = Depends(get_current_user),
):
    """Return current user info + linked provider ID.

    GET — no CSRF check needed (safe method).
    """
    return MeResponse(
        user=UserResponse(
            id=str(user.id), email=user.email, role=user.role.value
        ),
    )
