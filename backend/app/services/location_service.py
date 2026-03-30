"""
Provider location CRUD operations.

All functions take a db session and return data. The caller (route layer)
handles commits. Same pattern as profile_service.py.

Ownership check: every write verifies location.provider_id == the
authenticated provider's id. This prevents a provider from editing
another provider's locations by guessing UUIDs.

Lat/lng stay nullable — geocoding deferred to Sprint 7 (Nominatim).
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.provider import ProviderLocation


MAX_LOCATIONS_PER_PROVIDER = 10

# Fields a provider can set/update on a location.
# id and provider_id are system-managed, lat/lng are geocoder-managed.
LOCATION_EDITABLE_FIELDS = {
    "label",
    "practice_name",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "zip_code",
    "is_primary",
    "is_public",
}


async def get_provider_locations(
    db: AsyncSession, provider_id: uuid.UUID
) -> list[ProviderLocation]:
    """All locations for a provider — primary first, then alphabetical."""
    result = await db.execute(
        select(ProviderLocation)
        .where(ProviderLocation.provider_id == provider_id)
        .order_by(ProviderLocation.is_primary.desc(), ProviderLocation.label)
    )
    return list(result.scalars().all())


async def get_public_locations(
    db: AsyncSession, provider_id: uuid.UUID
) -> list[ProviderLocation]:
    """Public locations only — for the patient-facing profile (ADR-013)."""
    result = await db.execute(
        select(ProviderLocation)
        .where(
            ProviderLocation.provider_id == provider_id,
            ProviderLocation.is_public == True,  # noqa: E712 — SQLAlchemy needs == not `is`
        )
        .order_by(ProviderLocation.is_primary.desc(), ProviderLocation.label)
    )
    return list(result.scalars().all())

# data: dict and updates: dict are untyped dictionaries. The rest of the codebase uses Pydantic models and type hints carefully
# a TypedDict or just accepting the Pydantic model directly would make that contract explicit rather than implicit
async def create_location(
    db: AsyncSession, provider_id: uuid.UUID, data: dict
) -> ProviderLocation:
    """Add a new practice location.

    Enforces max 10 locations per provider and single-primary invariant.
    """
    existing = await get_provider_locations(db, provider_id)
    if len(existing) >= MAX_LOCATIONS_PER_PROVIDER:
        raise ValueError(
            f"Maximum {MAX_LOCATIONS_PER_PROVIDER} locations per provider"
        )

    # Filter to editable fields (defense in depth)
    # subtle ordering issue: #1, #2 below work but... This works, but 
    # between step 1 and step 2 there's a flush where two locations are 
    # both is_primary=True in the database. If you ever add a unique constraint 
    # or database-level check on this invariant, it would fail. 
    # The fix would be to clear the others before flushing the new one.
    # update_location has a similar issue
    safe_data = {k: v for k, v in data.items() if k in LOCATION_EDITABLE_FIELDS}

    if safe_data.get("is_primary"):
        await _clear_all_primaries(db, provider_id)  # no ID yet, use clear "all" primaries helper

    location = ProviderLocation(provider_id=provider_id, **safe_data)
    db.add(location)
    await db.flush()
    return location


async def update_location(
    db: AsyncSession,
    provider_id: uuid.UUID,
    location_id: uuid.UUID,
    updates: dict,
) -> ProviderLocation:
    """Update an existing location. Ownership-checked.

    Only keys present in `updates` are touched (exclude_unset pattern).
    """
    location = await _get_owned_location(db, provider_id, location_id)

    safe_updates = {
        k: v for k, v in updates.items() if k in LOCATION_EDITABLE_FIELDS
    }

    if safe_updates.get("is_primary"):
        await _clear_other_primaries(db, provider_id, location_id)  # we have the ID, use clear "other" primaries helper
    
    for field, value in safe_updates.items():
        setattr(location, field, value)

    db.add(location)
    await db.flush()  # then set
    return location


async def delete_location(
    db: AsyncSession, provider_id: uuid.UUID, location_id: uuid.UUID
) -> None:
    """Remove a location. Ownership-checked."""
    location = await _get_owned_location(db, provider_id, location_id)
    await db.delete(location)
    await db.flush()


# ── Internal helpers ─────────────────────────────────────────────


async def _get_owned_location(
    db: AsyncSession, provider_id: uuid.UUID, location_id: uuid.UUID
) -> ProviderLocation:
    """Fetch a location that belongs to this provider, or raise LookupError."""
    # If someone guesses another provider's location UUID, the query returns nothing and raises LookupError
    result = await db.execute(
        select(ProviderLocation).where(
            ProviderLocation.id == location_id,
            ProviderLocation.provider_id == provider_id,
        )
    )
    location = result.scalars().first()
    if location is None:
        raise LookupError("Location not found")  # deliberate (*not* "You don't own this location." Don't tell an attacker that an ID exists)
    return location


async def _clear_other_primaries(
    db: AsyncSession, provider_id: uuid.UUID, keep_id: uuid.UUID
) -> None:
    """Enforce single-primary: unset is_primary on all other locations."""
    result = await db.execute(
        select(ProviderLocation).where(
            ProviderLocation.provider_id == provider_id,
            ProviderLocation.id != keep_id,
            ProviderLocation.is_primary == True,  # noqa: E712
        )
    )
    for loc in result.scalars().all():
        loc.is_primary = False
        db.add(loc)


async def _clear_all_primaries(
    db: AsyncSession, provider_id: uuid.UUID
) -> None:
    """Unset is_primary on ALL locations for this provider.

    Used by create_location — the new location doesn't have an ID yet,
    so we can't use _clear_other_primaries (which needs a keep_id).
    """
    result = await db.execute(
        select(ProviderLocation).where(
            ProviderLocation.provider_id == provider_id,
            ProviderLocation.is_primary == True,  # noqa: E712
        )
    )
    for loc in result.scalars().all():
        loc.is_primary = False
        db.add(loc)