"""
Search service — distance + filter search for the provider directory.

Ported from ORToothFairy's SearchService.cs (~97 lines of C# → ~100 lines
of Python). Key difference: ohp-app has multiple ProviderLocations per
provider, so we find the closest location for each provider and use that
distance for filtering and sorting.

Haversine runs in application code (not SQL), matching the proven
ORToothFairy pattern. See ADR-004 for rationale.

All functions take a db session and return data. Same pattern as
profile_service.py — the caller (route layer) handles HTTP concerns.

(note: 6-decimal enforcement is the route layer (or a Pydantic model) 
 where the incoming query params are parsed)
"""

import logging
import math
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.enums import ProviderStatus
from app.models.provider import Provider, ProviderCredential, ProviderLocation
from app.models.search_log import SearchLog
from app.database import get_engine

logger = logging.getLogger(__name__)


# ── Haversine ─────────────────────────────────────────────────────


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in miles between two lat/lon points.

    Direct port of ORToothFairy's CalculateDistance().
    Earth radius = 3959.0 miles.
    """
    EARTH_RADIUS_MILES = 3959.0

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.sin(d_lon / 2) ** 2 * math.cos(lat1_r) * math.cos(lat2_r)
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_MILES * c


# ── Provider search ───────────────────────────────────────────────


async def search_providers(
    db: AsyncSession,
    lat: float,
    lon: float,
    *,
    radius_miles: int | None = None,
    provider_type: str | None = None,
    credential: str | None = None,
    accepting_new_patients: bool | None = None,
    insurance: str | None = None,
    featured: bool = False,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Search approved providers by distance + filters.

    Returns (results, total_count) where results is a list of dicts
    containing provider fields + distance metadata, paginated.

    Distance filtering applies both the user's search radius AND each
    provider's max_travel_miles (dual-radius, ported from C#).

    Tag logic:
      - featured=False (default): exclude providers tagged "example-profile"
      - featured=True: return ONLY providers tagged "example-profile"
    """
    # ── 1. Load approved providers ──
    # Loading all approved providers into memory — fine at your current scale 
    # (dozens to low hundreds). TODO: If you ever hit thousands, push filtering into SQL.
    result = await db.execute(
        select(Provider).where(Provider.status == ProviderStatus.APPROVED)
    )
    providers = list(result.scalars().all())

    if not providers:
        return [], 0

    provider_ids = [p.id for p in providers]

    # ── 2. Load their locations (one query, group in Python) ──
    loc_result = await db.execute(
        select(ProviderLocation).where(
            ProviderLocation.provider_id.in_(provider_ids)
        )
    )
    locations_by_provider: dict[uuid.UUID, list[ProviderLocation]] = {}
    for loc in loc_result.scalars().all():
        locations_by_provider.setdefault(loc.provider_id, []).append(loc)

    # ── 3. Load their credentials (one query, group in Python) ──
    cred_result = await db.execute(
        select(ProviderCredential).where(
            ProviderCredential.provider_id.in_(provider_ids)
        )
    )
    creds_by_provider: dict[uuid.UUID, list[str]] = {}
    for pc in cred_result.scalars().all():
        creds_by_provider.setdefault(pc.provider_id, []).append(
            pc.credential_code
        )

    # ── 4. Calculate distances and filter ──
    # scored: list[tuple[Provider, float, ProviderLocation | None]] = [] # no, you continue when there are no geocoded locations, remove None
    scored: list[tuple[Provider, float, ProviderLocation ]] = []

    for provider in providers:
        # ── Tag filtering (example-profile) ──
        tags = provider.tags or []
        is_example = "example-profile" in tags
        if featured and not is_example:
            continue
        if not featured and is_example:
            continue

        # ── Filter: provider_type ──
        if provider_type and provider.provider_type.value != provider_type:
            continue

        # ── Filter: accepting_new_patients ──
        if (
            accepting_new_patients is not None
            and provider.accepting_new_patients != accepting_new_patients
        ):
            continue

        # ── Filter: credential ──
        if credential:
            codes = creds_by_provider.get(provider.id, [])
            if credential not in codes:
                continue

        # ── Filter: insurance (case-insensitive substring match) ──
        # "Med" would match "Medicare", "Medicaid", and "MedStar"
        # TODO: is this waht you really want? You might have to review the logs
        # or get provider feedback after people actually use this
        if insurance:
            accepted = provider.insurance_accepted or []
            if not any(insurance.lower() in ins.lower() for ins in accepted):
                continue

        # ── Distance: find closest geocoded location ──
        locs = locations_by_provider.get(provider.id, [])
        geocoded_locs = [
            loc
            for loc in locs
            if loc.latitude is not None and loc.longitude is not None
        ]

        if not geocoded_locs:
            # Provider has no geocoded locations — can't appear in
            # distance-based search. Still in the directory, just not
            # findable by location.
            continue

        closest_loc = None
        min_dist = float("inf")
        for loc in geocoded_locs:
            d = haversine(lat, lon, loc.latitude, loc.longitude)
            if d < min_dist:
                min_dist = d
                closest_loc = loc

        # ── Dual-radius filter (ported from C#) ──
        # 1. User's search radius
        if radius_miles is not None and min_dist > radius_miles:
            continue
        # 2. Provider's max travel distance
        if (
            provider.max_travel_miles is not None
            and min_dist > provider.max_travel_miles
        ):
            continue

        scored.append((provider, min_dist, closest_loc))

    # ── 5. Sort by distance ──
    scored.sort(key=lambda x: x[1])

    total_count = len(scored)

    # ── 6. Paginate ──
    start = (page - 1) * per_page
    end = start + per_page
    page_results = scored[start:end]

    # ── 7. Build result dicts ──
    results = []
    for provider, distance, closest_loc in page_results:
        # Strip "example-profile" from tags shown to patients
        visible_tags = [
            t for t in (provider.tags or []) if t != "example-profile"
        ]

        results.append(
            {
                "id": str(provider.id),
                "slug": provider.slug,
                "display_name": provider.display_name,
                "provider_type": provider.provider_type.value,
                "title_line": provider.title_line,
                "bio": provider.bio,
                "mission_statement": provider.mission_statement,
                "photo_url": provider.photo_url,
                "phone": provider.phone,
                "public_email": provider.public_email,
                "website": provider.website,
                "credentials": creds_by_provider.get(provider.id, []),
                "accepting_new_patients": provider.accepting_new_patients,
                "availability": (
                    provider.availability.value
                    if provider.availability
                    else None
                ),
                "tags": visible_tags,
                "insurance_accepted": provider.insurance_accepted,
                "services": provider.services,
                "specialties": provider.specialties,
                "populations_served": provider.populations_served,
                "languages": provider.languages,
                "distance_miles": round(distance, 1),
                "nearest_location_city": (
                    closest_loc.city if closest_loc else None
                ),
                "nearest_location_state": (
                    closest_loc.state if closest_loc else None
                ),
            }
        )

    return results, total_count


# ── Search logging ────────────────────────────────────────────────
async def log_search(
    *,
    query_text: str | None,
    filters_applied: dict | None,
    result_provider_ids: list[str],
    result_count: int,
) -> None:
    """Fire-and-forget search log insert.

    Opens its own session so it can't interfere with the caller's
    transaction. Called via FastAPI BackgroundTasks — runs after the response
    is already sent. So you don't session.commit() everything else when you
    just want to commit search_log data.
    """
    # from app.database import get_engine  # local import to avoid circular deps? it's ok here, use top of file

    from sqlalchemy.ext.asyncio import AsyncSession

    try:
        async with AsyncSession(get_engine()) as session:
            log_entry = SearchLog(
                query_text=query_text,
                filters_applied=filters_applied,
                result_provider_ids=result_provider_ids,
                result_count=result_count,
            )
            session.add(log_entry)
            await session.commit()
    except Exception:
        logger.warning("Failed to log search", exc_info=True)
