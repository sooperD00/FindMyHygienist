"""
Search endpoints: patient-facing provider search and filter dropdowns.

Public (no auth required):
  GET /api/providers         — distance + filter search
  GET /api/providers/types   — provider type enum values for dropdown

No CSRF needed — these are read-only GET endpoints (the search log
insert is fire-and-forget inside the GET handler).

Dependency chain:
  GET /api/providers       → get_session (public, no auth)
  GET /api/providers/types → none (static enum, no DB)

Three input methods for location (priority: lat/lon > zip > address),
matching ORToothFairy's SearchController. Geocoding reuses the existing
geocoding_service (ADR-004).

Validate lat/lon 6 decimal places for cm accuracy - see _normalize_coords()
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.enums import ProviderType
from app.services import search_service
from app.services.geocoding_service import geocode_address, geocode_zip

router = APIRouter(tags=["search"])


# ── Helpers ──────────────────────────────────────────────

def _normalize_coords(lat: float, lon: float) -> tuple[float, float]:
    """Round to 6 decimals (~11cm) — sufficient for provider search."""
    return round(lat, 6), round(lon, 6)


# ── Response schemas ──────────────────────────────────────────────


class ProviderSearchResult(BaseModel):
    """Search result card — the full public profile plus distance metadata.

    The frontend decides how much to show (truncated bio, first N
    specialties with a "+X more" chip, etc). The backend returns
    everything so the card rendering is a pure frontend concern.
    """

    id: str
    slug: str
    display_name: str
    provider_type: str
    title_line: str | None
    bio: str | None
    mission_statement: str | None
    photo_url: str | None
    phone: str | None
    public_email: str | None
    website: str | None
    credentials: list[str]
    accepting_new_patients: bool
    availability: str | None
    tags: list[str]
    insurance_accepted: list[str] | None
    services: list[str] | None
    specialties: list[str] | None
    populations_served: list[str] | None
    languages: list[str] | None
    # Distance metadata — not on the provider model, computed per search
    distance_miles: float
    nearest_location_city: str | None
    nearest_location_state: str | None


class SearchResponse(BaseModel):
    """Paginated search results with metadata."""

    results: list[ProviderSearchResult]
    count: int  # results on this page
    page: int
    per_page: int
    total_count: int  # total across all pages (for "showing 1–20 of 47")
    search_location: str | None  # display name of resolved location


class ProviderTypeResponse(BaseModel):
    """A single provider type for the filter dropdown."""

    code: str
    label: str


# ── Endpoints ─────────────────────────────────────────────────────


@router.get("/api/providers", response_model=SearchResponse)
async def search_providers(
    background_tasks: BackgroundTasks,
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    zip_code: str | None = Query(default=None, alias="zipCode"),
    address: str | None = Query(default=None),
    radius_miles: int | None = Query(default=None, alias="radiusMiles"),
    provider_type: str | None = Query(default=None, alias="providerType"),
    credential: str | None = Query(default=None),
    accepting_new_patients: bool | None = Query(
        default=None, alias="acceptingNewPatients"
    ),
    insurance: str | None = Query(default=None),
    featured: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100, alias="perPage"),
    db: AsyncSession = Depends(get_session),
):
    """Search for providers by location + filters.

    Three input methods (priority: lat/lon > zip > address):
      - latitude + longitude: direct coordinates (e.g. browser geolocation)
      - zipCode: US zip code, geocoded via Nominatim
      - address: freeform address string, geocoded via Nominatim

    Filters: providerType, credential, acceptingNewPatients, insurance.
    featured=true returns only example-profile providers (landing page).

    Returns approved providers only, sorted by distance (nearest first).
    """
    lat: float
    lon: float
    search_location: str | None = None

    # ── Resolve coordinates ──────────────────────────────────────
    if latitude is not None and longitude is not None:
        if not (-90 <= latitude <= 90):
            raise HTTPException(
                400, detail="Latitude must be between -90 and 90"
            )
        if not (-180 <= longitude <= 180):
            raise HTTPException(
                400, detail="Longitude must be between -180 and 180"
            )
        lat, lon = _normalize_coords(latitude, longitude)
        search_location = f"({lat}, {lon})"

    elif zip_code:
        geo = await geocode_zip(zip_code)
        if geo is None:
            raise HTTPException(
                400,
                detail=f"Could not find location for zip code: {zip_code}",
            )
        lat, lon = _normalize_coords(geo.latitude, geo.longitude)
        search_location = geo.display_name

    elif address:
        geo = await geocode_address(address)
        if geo is None:
            raise HTTPException(
                400,
                detail=f"Could not find location for address: {address}",
            )
        lat, lon = _normalize_coords(geo.latitude, geo.longitude)
        search_location = geo.display_name

    else:
        raise HTTPException(
            400,
            detail="Must provide latitude+longitude, zipCode, or address",
        )

    # ── Validate radius ──────────────────────────────────────────
    if radius_miles is not None and radius_miles <= 0:
        raise HTTPException(
            400, detail="radiusMiles must be greater than 0"
        )

    # ── Search ───────────────────────────────────────────────────
    results, total_count = await search_service.search_providers(
        db,
        lat,
        lon,
        radius_miles=radius_miles,
        provider_type=provider_type,
        credential=credential,
        accepting_new_patients=accepting_new_patients,
        insurance=insurance,
        featured=featured,
        page=page,
        per_page=per_page,
    )

    # ── Build response ───────────────────────────────────────────
    response = SearchResponse(
        results=[ProviderSearchResult(**r) for r in results],
        count=len(results),
        page=page,
        per_page=per_page,
        total_count=total_count,
        search_location=search_location,
    )

    # ── Log search (fire-and-forget) ─────────────────────────────
    # Build a filters dict for analytics — only non-None filters
    filters: dict = {}
    if radius_miles is not None:
        filters["radius_miles"] = radius_miles
    if provider_type:
        filters["provider_type"] = provider_type
    if credential:
        filters["credential"] = credential
    if accepting_new_patients is not None:
        filters["accepting_new_patients"] = accepting_new_patients
    if insurance:
        filters["insurance"] = insurance
    if featured:
        filters["featured"] = True

    # fire-and-forget — runs after the response is sent
    background_tasks.add_task(
        search_service.log_search,
        query_text=search_location,
        filters_applied=filters or None,
        result_provider_ids=[r.id for r in response.results],
        result_count=total_count,
    )

    return response


# ── Oregon geographic centroid — used as the reference point for
#    featured providers so distance_miles shows a realistic value
#    (roughly "distance from the center of the state") rather than 0.
#    No user input needed; this is a display-only number.
OREGON_CENTROID_LAT = 43.8041
OREGON_CENTROID_LON = -120.5542
FEATURED_MAX = 20


@router.get("/api/providers/featured", response_model=SearchResponse)
async def get_featured_providers(
    db: AsyncSession = Depends(get_session),
):
    """Featured (example-profile) providers for the landing page.

    Lightweight endpoint — no location input required. Uses the Oregon
    geographic centroid as the reference point so distance_miles values
    look natural ("~45 mi" from center of state) rather than 0.

    No search logging — this isn't a real search, it's a showcase.
    """
    results, total_count = await search_service.search_providers(
        db,
        OREGON_CENTROID_LAT,
        OREGON_CENTROID_LON,
        featured=True,
    )

    return SearchResponse(
        results=[ProviderSearchResult(**r) for r in results],
        count=len(results),
        page=1,
        per_page=FEATURED_MAX,
        total_count=total_count,
        search_location="Oregon",
    )


@router.get("/api/providers/types", response_model=list[ProviderTypeResponse])
async def get_provider_types():
    """Provider type enum values for the search filter dropdown.

    Returns all ProviderType enum values with human-readable labels.
    No auth, no DB — this is a static list baked into the code.
    """
    return [
        ProviderTypeResponse(
            code=pt.value,
            label=pt.value.replace("_", " ").title(),
        )
        for pt in ProviderType
    ]
