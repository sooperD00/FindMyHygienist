"""
Profile operations: read/write provider profiles, credential management.

All functions take a db session and return data. The caller (route layer)
handles commits. Same pattern as session_service.py and auth_service.py.

Draft behavior (ADR-003): when an APPROVED provider edits their profile,
changes land in the `draft` JSON column — the live profile stays unchanged
until an admin approves. PENDING or CHANGES_REQUESTED providers edit
live fields directly (there's nothing live to protect yet).
"""

import uuid

from sqlalchemy import delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.credential import Credential
from app.models.provider import Provider, ProviderCredential
from app.models.enums import ProviderStatus


# ── Credentials (reference table) ─────────────────────────────────


async def get_all_credentials(db: AsyncSession) -> list[Credential]:
    """All valid credential codes, ordered by type then code.

    Powers the intake form checkboxes and tappable chips on profiles.
    This is a reference table — it's small (17 rows) and never changes
    at runtime.
    """
    result = await db.execute(
        select(Credential).order_by(Credential.credential_type, Credential.code)
    )
    return list(result.scalars().all())


async def validate_credential_codes(
    db: AsyncSession, codes: list[str]
) -> list[str]:
    """Return any codes from the input list that don't exist in the
    Credential table. Empty list = all valid."""
    if not codes:
        return []
    result = await db.execute(select(Credential.code))
    valid_codes = {row for row in result.scalars().all()}
    return [c for c in codes if c not in valid_codes]


# ── Provider lookup ───────────────────────────────────────────────


async def get_provider_by_user_id(
    db: AsyncSession, user_id: uuid.UUID
) -> Provider | None:
    """Look up the Provider record linked to this User.

    Returns None if the user has no Provider (e.g., admin account).
    """
    result = await db.execute(
        select(Provider).where(Provider.user_id == user_id)
    )
    return result.scalars().first()


async def get_provider_credentials(
    db: AsyncSession, provider_id: uuid.UUID
) -> list[Credential]:
    """Get full Credential objects for a provider (via the join table).

    Returns Credential rows (with patient_description etc.), not just
    codes — the frontend needs the full objects for chip rendering.
    """
    result = await db.execute(
        select(Credential)
        .join(
            ProviderCredential,
            ProviderCredential.credential_code == Credential.code,
        )
        .where(ProviderCredential.provider_id == provider_id)
        .order_by(Credential.credential_type, Credential.code)
    )
    return list(result.scalars().all())


async def get_provider_public(
    db: AsyncSession, slug: str, provider_id: uuid.UUID
) -> Provider | None:
    """Fetch an APPROVED provider by slug + id for the public profile page.

    Both slug and id must match — the slug is for SEO/readability, the
    id is the real lookup key. Requiring both prevents someone from
    guessing UUIDs without the vanity URL. Returns None if not found
    or not approved.
    """
    result = await db.execute(
        select(Provider).where(
            Provider.id == provider_id,
            Provider.slug == slug,
            Provider.status == ProviderStatus.APPROVED,
        )
    )
    return result.scalars().first()


# ── Profile updates ───────────────────────────────────────────────

# Fields that a provider can edit via PUT /api/me/profile.
# display_name and provider_type are included — a provider might change
# their name or reclassify (e.g., RDH → EPDH after earning the credential).
# slug is NOT editable (it's generated from display_name at registration).
# status, auto_approved, reviewed_by, reviewed_at are admin-controlled.
EDITABLE_FIELDS = {
    "display_name",
    "provider_type",
    "title_line",
    "bio",
    "mission_statement",
    "phone",
    "public_email",
    "website",
    "languages",
    "services",
    "specialties",
    "populations_served",
    "insurance_accepted",
    "tags",
    "availability",
    "accepting_new_patients",
    "max_travel_miles",
    "accepts_texts",
    "accepts_calls",
}


async def update_provider_profile(
    db: AsyncSession, provider: Provider, updates: dict
) -> Provider:
    """Apply profile updates. Draft vs. live depends on current status.

    - APPROVED: changes go into provider.draft (live stays untouched).
    - PENDING / CHANGES_REQUESTED: changes go directly to live fields
      (nothing is live yet, or the provider is actively revising).
    - SUSPENDED: reject edits (provider shouldn't be editing).

    Only keys present in `updates` are touched — Pydantic's
    exclude_unset=True on the request model ensures we don't clobber
    fields the provider didn't include in the request body.
    """
    # Filter to only allowed fields (defense in depth — the Pydantic
    # schema already limits what the request can contain, but the service
    # layer shouldn't trust the caller blindly).
    safe_updates = {k: v for k, v in updates.items() if k in EDITABLE_FIELDS}

    if not safe_updates:
        return provider

    if provider.status == ProviderStatus.SUSPENDED:
        raise ValueError("Cannot edit a suspended profile")

    if provider.status == ProviderStatus.APPROVED:
        # Merge into existing draft (there might already be pending edits).
        # Draft is a JSON column — enums must be serialized to strings.
        json_safe = {
            k: (v.value if hasattr(v, "value") else v)
            for k, v in safe_updates.items()
        }
        existing_draft = provider.draft or {}
        existing_draft.update(json_safe)
        provider.draft = existing_draft
        # TODO (Sprint 9 / ADR-012): set provider.draft_status = DraftStatus.REVIEW_NEEDED here
    else:
        # PENDING or CHANGES_REQUESTED — write directly to live fields
        for field, value in safe_updates.items():
            setattr(provider, field, value)
        # TODO (Sprint 9 / ADR-012): set provider.draft_status = DraftStatus.REVIEW_NEEDED here too

    db.add(provider)
    await db.flush()
    return provider


# ── Credential replacement ────────────────────────────────────────


async def replace_provider_credentials(
    db: AsyncSession,
    provider_id: uuid.UUID,
    credential_codes: list[str],
) -> list[Credential]:
    """Replace a provider's credential list entirely.

    Delete-then-insert inside the same transaction — if the insert
    fails (e.g., invalid code hits FK constraint), the delete rolls
    back with it. See the discussion with Nicole about atomicity.

    Returns the full Credential objects for the new set (for the
    response body).
    """
     # TODO (Sprint 9 / ADR-012): For APPROVED providers, stash credential
    # codes in provider.draft["credentials"] instead of writing to the join
    # table directly. Admin approval merges them. Currently all credential
    # changes go live immediately regardless of provider status — inconsistent
    # with update_provider_profile() which routes APPROVED edits through draft.
    # PENDING providers (conference) can keep the direct-write path.

    # Validate all codes exist before touching anything
    invalid = await validate_credential_codes(db, credential_codes)
    if invalid:
        raise ValueError(f"Invalid credential codes: {', '.join(invalid)}")

    # Delete existing
    await db.execute(
        sa_delete(ProviderCredential).where(
            ProviderCredential.provider_id == provider_id
        )
    )

    # Insert new (deduplicate — a provider shouldn't send ["RDH", "RDH"])
    seen = set()
    for code in credential_codes:
        if code not in seen:
            seen.add(code)
            db.add(ProviderCredential(
                provider_id=provider_id, credential_code=code
            ))

    await db.flush()

    # Return full Credential objects (not just codes) for the response
    return await get_provider_credentials(db, provider_id)
