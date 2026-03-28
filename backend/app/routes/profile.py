"""
Profile endpoints: credential reference data, own-profile CRUD, public profiles.

Two audiences, one router:
  - Public (no auth): GET /api/credentials, GET /api/providers/{slug}/{id}
  - Provider (auth required): GET /api/me/profile, PUT /api/me/profile,
    PUT /api/me/credentials

GET endpoints use get_current_user (session check, no CSRF).
PUT endpoints use csrf_protect (session + CSRF token — state-changing).
Same dependency pattern as routes/auth.py.

Dependency chains:
GET  /api/credentials              → get_session (public, no auth)
GET  /api/providers/{slug}/{id}    → get_session (public, no auth)
GET  /api/me/profile               → get_current_user → get_session
PUT  /api/me/profile               → csrf_protect → get_current_user → get_session
PUT  /api/me/credentials           → csrf_protect → get_current_user → get_session

"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import csrf_protect, get_current_user
from app.models.enums import (
    Availability,
    CredentialType,
    ProviderStatus,
    ProviderType,
)
from app.models.user import User
from app.services import profile_service

router = APIRouter(tags=["profile"])


# ── Response schemas ──────────────────────────────────────────────


class CredentialResponse(BaseModel):
    """A single Oregon credential with patient-facing description."""

    code: str
    full_name: str
    patient_description: str
    credential_type: CredentialType


class OwnProfileResponse(BaseModel):
    """Provider's view of their own profile — includes draft and status."""

    id: str
    display_name: str
    slug: str
    provider_type: ProviderType
    title_line: str | None = None
    bio: str | None = None
    mission_statement: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    public_email: str | None = None
    website: str | None = None
    languages: list[str] | None = None
    services: list[str] | None = None
    specialties: list[str] | None = None
    populations_served: list[str] | None = None
    insurance_accepted: list[str] | None = None
    tags: list[str] | None = None
    availability: Availability | None = None
    accepting_new_patients: bool
    max_travel_miles: int | None = None
    accepts_texts: bool
    accepts_calls: bool
    status: ProviderStatus
    draft: dict | None = None
    reviewed_at: str | None = None  # ISO string, not raw datetime (enforced by helper below)
    credentials: list[CredentialResponse]
    created_at: str | None = None
    updated_at: str | None = None


class PublicProfileResponse(BaseModel):
    """Patient-facing provider profile — no draft, no admin metadata."""

    id: str
    display_name: str
    slug: str
    provider_type: ProviderType
    title_line: str | None = None
    bio: str | None = None
    mission_statement: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    public_email: str | None = None
    website: str | None = None
    languages: list[str] | None = None
    services: list[str] | None = None
    specialties: list[str] | None = None
    populations_served: list[str] | None = None
    insurance_accepted: list[str] | None = None
    tags: list[str] | None = None
    availability: Availability | None = None
    accepting_new_patients: bool
    max_travel_miles: int | None = None
    accepts_texts: bool
    accepts_calls: bool
    credentials: list[CredentialResponse]


# ── Request schemas ───────────────────────────────────────────────


class ProfileUpdateRequest(BaseModel):
    """Fields a provider can edit. All optional — only include what changed.

    Pydantic's exclude_unset=True in the route handler ensures we only
    touch fields the provider actually sent, so missing fields don't
    get nulled out.
    """

    display_name: str | None = None
    provider_type: ProviderType | None = None
    title_line: str | None = None
    bio: str | None = None
    mission_statement: str | None = None
    phone: str | None = None
    public_email: EmailStr | None = None
    website: str | None = None
    languages: list[str] | None = None
    services: list[str] | None = None
    specialties: list[str] | None = None
    populations_served: list[str] | None = None
    insurance_accepted: list[str] | None = None
    tags: list[str] | None = None
    availability: Availability | None = None
    accepting_new_patients: bool | None = None
    max_travel_miles: int | None = None
    accepts_texts: bool | None = None
    accepts_calls: bool | None = None


class CredentialUpdateRequest(BaseModel):
    """Replace a provider's credential list entirely."""

    codes: list[str] = Field(
        ..., description="Credential codes, e.g. ['RDH', 'BSDH', 'LAP']"
    )


# ── Helpers ───────────────────────────────────────────────────────

# Datetime fields are str | None rather than datetime | None by design.
# Pydantic/FastAPI auto-serialize datetime to ISO format, but their
# handling of timezone-aware vs naive datetimes can produce inconsistent
# suffixes (trailing Z, +00:00, or nothing). Manual .isoformat() in
# _provider_to_own_response() keeps the format predictable at the cost
# of losing structural enforcement — Pydantic won't reject a malformed
# string here. If we later standardize on timezone-aware datetimes
# everywhere, switching these to datetime | None is the cleaner path.

def _credential_to_response(cred) -> CredentialResponse:
    return CredentialResponse(
        code=cred.code,
        full_name=cred.full_name,
        patient_description=cred.patient_description,
        credential_type=cred.credential_type,
    )


def _provider_to_own_response(
    provider, credentials: list
) -> OwnProfileResponse:
    return OwnProfileResponse(
        id=str(provider.id),
        display_name=provider.display_name,
        slug=provider.slug,
        provider_type=provider.provider_type,
        title_line=provider.title_line,
        bio=provider.bio,
        mission_statement=provider.mission_statement,
        photo_url=provider.photo_url,
        phone=provider.phone,
        public_email=provider.public_email,
        website=provider.website,
        languages=provider.languages,
        services=provider.services,
        specialties=provider.specialties,
        populations_served=provider.populations_served,
        insurance_accepted=provider.insurance_accepted,
        tags=provider.tags,
        availability=provider.availability,
        accepting_new_patients=provider.accepting_new_patients,
        max_travel_miles=provider.max_travel_miles,
        accepts_texts=provider.accepts_texts,
        accepts_calls=provider.accepts_calls,
        status=provider.status,
        draft=provider.draft,
        reviewed_at=(
            provider.reviewed_at.isoformat() if provider.reviewed_at else None
        ),
        credentials=[_credential_to_response(c) for c in credentials],
        created_at=(
            provider.created_at.isoformat() if provider.created_at else None
        ),
        updated_at=(
            provider.updated_at.isoformat() if provider.updated_at else None
        ),
    )


def _provider_to_public_response(
    provider, credentials: list
) -> PublicProfileResponse:
    return PublicProfileResponse(
        id=str(provider.id),
        display_name=provider.display_name,
        slug=provider.slug,
        provider_type=provider.provider_type,
        title_line=provider.title_line,
        bio=provider.bio,
        mission_statement=provider.mission_statement,
        photo_url=provider.photo_url,
        phone=provider.phone,
        public_email=provider.public_email,
        website=provider.website,
        languages=provider.languages,
        services=provider.services,
        specialties=provider.specialties,
        populations_served=provider.populations_served,
        insurance_accepted=provider.insurance_accepted,
        tags=provider.tags,
        availability=provider.availability,
        accepting_new_patients=provider.accepting_new_patients,
        max_travel_miles=provider.max_travel_miles,
        accepts_texts=provider.accepts_texts,
        accepts_calls=provider.accepts_calls,
        credentials=[_credential_to_response(c) for c in credentials],
    )


# ── Public endpoints ──────────────────────────────────────────────


@router.get("/api/credentials", response_model=list[CredentialResponse])
async def list_credentials(db: AsyncSession = Depends(get_session)):
    """All valid Oregon credential codes — powers intake form checkboxes
    and tappable chips on provider profiles."""
    credentials = await profile_service.get_all_credentials(db)
    return [_credential_to_response(c) for c in credentials]


@router.get(
    "/api/providers/{slug}/{id}",
    response_model=PublicProfileResponse,
)
async def get_public_profile(
    slug: str,
    id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
):
    """Public provider profile — approved providers only.

    Both slug and id must match. The slug is for SEO/readability;
    the id is the real lookup key.
    """
    provider = await profile_service.get_provider_public(db, slug, id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    credentials = await profile_service.get_provider_credentials(
        db, provider.id
    )
    return _provider_to_public_response(provider, credentials)


# ── Authenticated endpoints (own profile) ─────────────────────────


@router.get("/api/me/profile", response_model=OwnProfileResponse)
async def get_own_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Provider's view of their own profile, including draft and credentials."""
    provider = await profile_service.get_provider_by_user_id(db, user.id)
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail="No provider profile linked to this account",
        )

    credentials = await profile_service.get_provider_credentials(
        db, provider.id
    )
    return _provider_to_own_response(provider, credentials)


@router.put("/api/me/profile", response_model=OwnProfileResponse)
async def update_own_profile(
    body: ProfileUpdateRequest,
    user: User = Depends(csrf_protect),
    db: AsyncSession = Depends(get_session),
):
    """Update own profile fields.

    If the profile is APPROVED, changes land in the draft column
    (live profile stays untouched until admin approves). If PENDING
    or CHANGES_REQUESTED, changes go directly to live fields.
    """
    provider = await profile_service.get_provider_by_user_id(db, user.id)
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail="No provider profile linked to this account",
        )

    updates = body.model_dump(exclude_unset=True)
    # Convert EmailStr back to plain str for storage
    if "public_email" in updates and updates["public_email"] is not None:
        updates["public_email"] = str(updates["public_email"])

    try:
        provider = await profile_service.update_provider_profile(
            db, provider, updates
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()

    credentials = await profile_service.get_provider_credentials(
        db, provider.id
    )
    return _provider_to_own_response(provider, credentials)


@router.put(
    "/api/me/credentials",
    response_model=list[CredentialResponse],
)
async def update_own_credentials(
    body: CredentialUpdateRequest,
    user: User = Depends(csrf_protect),
    db: AsyncSession = Depends(get_session),
):
    """Replace this provider's credential list entirely.

    Sends the full list of credential codes — the backend deletes
    existing and inserts new in one transaction. See atomicity
    discussion: if the insert fails, the delete rolls back.
    """
    provider = await profile_service.get_provider_by_user_id(db, user.id)
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail="No provider profile linked to this account",
        )

    try:
        credentials = await profile_service.replace_provider_credentials(
            db, provider.id, body.codes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()

    return [_credential_to_response(c) for c in credentials]
