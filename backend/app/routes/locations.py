"""
Provider location CRUD endpoints.

GET    /api/me/locations              — list own locations (all, including private)
POST   /api/me/locations              — add a location
PUT    /api/me/locations/{id}         — edit a location
DELETE /api/me/locations/{id}         — remove a location

All authenticated. GET uses get_current_user (no CSRF needed for reads).
POST/PUT/DELETE use csrf_protect (state-changing).

Public location display is handled in profile.py — the public profile
endpoint calls location_service.get_public_locations() and returns
only label + city + state (ADR-013).

Dependency chains:
GET    /api/me/locations              → get_current_user → get_session
POST   /api/me/locations              → csrf_protect → get_current_user → get_session
PUT    /api/me/locations/{id}         → csrf_protect → get_current_user → get_session
DELETE /api/me/locations/{id}         → csrf_protect → get_current_user → get_session
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_provider, get_current_provider_csrf
from app.models.provider import Provider
from app.services import location_service

router = APIRouter(tags=["locations"])


# ── Response schemas ─────────────────────────────────────────────


class OwnLocationResponse(BaseModel):
    """Provider's view of their own location — full address, all fields.

    Used on the provider dashboard. Includes private locations so the
    provider can manage them.
    """

    id: str
    label: str
    practice_name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str
    zip_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_primary: bool
    is_public: bool


class PublicLocationResponse(BaseModel):
    """Patient-facing location — label + practice name + city + state (ADR-013).

    Never includes street address, zip code, or coordinates.
    Patients see "Main Office — Pacific Dental Services — Portland, OR"
    and contact the provider directly. Full address display is a future opt-in.
    """

    id: str
    label: str
    practice_name: str | None = None
    city: str | None = None
    state: str
    is_primary: bool


# ── Request schemas ──────────────────────────────────────────────


class LocationCreateRequest(BaseModel):
    """Create a new practice location. Label is required; address
    fields are optional (zip-code-only private locations are valid)."""

    label: str = Field(max_length=100)
    practice_name: str | None = Field(default=None, max_length=200)
    address_line1: str | None = Field(default=None, max_length=300)
    address_line2: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    state: str = Field(default="OR", max_length=2)
    zip_code: str | None = Field(default=None, max_length=10)
    is_primary: bool = False
    is_public: bool = True


class LocationUpdateRequest(BaseModel):
    """Update a location. All fields optional — only include what changed.

    Uses exclude_unset pattern so missing fields don't get nulled out.
    """

    label: str | None = Field(default=None, max_length=100)
    practice_name: str | None = Field(default=None, max_length=200)
    address_line1: str | None = Field(default=None, max_length=300)
    address_line2: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=2)
    zip_code: str | None = Field(default=None, max_length=10)
    is_primary: bool | None = None
    is_public: bool | None = None


# ── Helpers ──────────────────────────────────────────────────────
# Pydantic's model_validate could do this more concisely, 
# but the explicit mapping is easier to audit for a security-sensitive 
# boundary like "what does the patient see.

def _location_to_own_response(loc) -> OwnLocationResponse:
    return OwnLocationResponse(
        id=str(loc.id),
        label=loc.label,
        practice_name=loc.practice_name,
        address_line1=loc.address_line1,
        address_line2=loc.address_line2,
        city=loc.city,
        state=loc.state,
        zip_code=loc.zip_code,
        latitude=loc.latitude,
        longitude=loc.longitude,
        is_primary=loc.is_primary,
        is_public=loc.is_public,
    )


def _location_to_public_response(loc) -> PublicLocationResponse:
    return PublicLocationResponse(
        id=str(loc.id),
        label=loc.label,
        practice_name=loc.practice_name,
        city=loc.city,
        state=loc.state,
        is_primary=loc.is_primary,
    )


# ── Endpoints ────────────────────────────────────────────────────


@router.get("/api/me/locations", response_model=list[OwnLocationResponse])
async def list_own_locations(
    provider: Provider = Depends(get_current_provider),
    db: AsyncSession = Depends(get_session),
):
    """All locations for the authenticated provider, including private."""
    locations = await location_service.get_provider_locations(db, provider.id)
    return [_location_to_own_response(loc) for loc in locations]


@router.post("/api/me/locations", response_model=OwnLocationResponse, status_code=201)
async def create_location(
    body: LocationCreateRequest,
    provider: Provider = Depends(get_current_provider_csrf),
    db: AsyncSession = Depends(get_session),
):
    """Add a new practice location (max 10 per provider)."""
    try:
        location = await location_service.create_location(
            db, provider.id, body.model_dump()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    await db.refresh(location)
    return _location_to_own_response(location)

# partial update is a PATCH
@router.patch("/api/me/locations/{location_id}", response_model=OwnLocationResponse)
async def update_location(
    location_id: uuid.UUID,
    body: LocationUpdateRequest,
    provider: Provider = Depends(get_current_provider_csrf),
    db: AsyncSession = Depends(get_session),
):
    """Update a location's fields. Ownership-checked."""
    updates = body.model_dump(exclude_unset=True)  # this is how the update patterns works; Fields the client didn't send are excluded, so they don't get overwritten to None; Pydantic equivalent of a SQL PATCH
    try:
        location = await location_service.update_location(
            db, provider.id, location_id, updates
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Location not found")

    await db.commit()
    await db.refresh(location)
    return _location_to_own_response(location)


@router.delete("/api/me/locations/{location_id}", status_code=204)
async def delete_location(
    location_id: uuid.UUID,
    provider: Provider = Depends(get_current_provider_csrf),
    db: AsyncSession = Depends(get_session),
):
    """Remove a location. Ownership-checked."""
    try:
        await location_service.delete_location(db, provider.id, location_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Location not found")

    await db.commit()
