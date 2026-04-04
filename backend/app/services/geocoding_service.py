"""
Geocoding service — converts zip codes and addresses to lat/lng.

Uses Nominatim (OpenStreetMap's free geocoding API). Ported from
ORToothFairy's GeocodingService.cs (~30 lines of C# → ~50 lines of
Python). See ADR-004 (revised).

Nominatim usage policy: max 1 req/sec, descriptive User-Agent.
FindMyHygienist's volume (single-digit QPS at peak) is well within this.

Geocoding is best-effort — functions return None on bad input, empty
results, or network errors. A failed geocode should never block a
location save. (policy decision baked into the code here).

No class for GeocodingService (no state to hold between calls, just use plain functions)
"""

import os 
import logging
from dataclasses import dataclass

# httpx is how your Python backend talks to Nominatim's REST API
# Standard Python async HTTP client library
import httpx

logger = logging.getLogger(__name__)

NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"

# USER_AGENT is an HTTP header sent to Nominatim's servers with every geocoding request. 
# It's their usage policy: "tell us who you are so we can contact you if your app misbehaves."
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "nicole.rowsey@gmail.com")
USER_AGENT = f"FindMyHygienist/1.0 ({ADMIN_EMAIL})"

TIMEOUT_SECONDS = 10.0


@dataclass
class GeocodingResult:
    latitude: float
    longitude: float
    display_name: str


async def geocode_zip(zip_code: str) -> GeocodingResult | None:
    """Convert a US zip code to lat/lng.

    Example: "97006" → GeocodingResult(45.487500, -122.803700, ...)
    Returns None on invalid input, no results, or network error.
    """
    # Clean and validate (same logic as C# original)
    # cleaned = zip_code.strip().replace("-", "").replace(" ", "")
    # cleaned = zip_code.strip().split("-")[0].strip().replace(" ", "")
    cleaned = zip_code.strip().replace("-", "").replace(" ", "")[:5] # just take first 5
    if len(cleaned) != 5 or not cleaned.isdigit():
        return None

    params = {
        "postalcode": cleaned,
        "country": "US",
        "format": "json",
        "limit": "1",
    }
    return await _nominatim_search(params, label=f"zip:{zip_code}")


async def geocode_address(address: str) -> GeocodingResult | None:
    """Convert a freeform address string to lat/lng.

    Example: "123 Main St, Portland, OR 97201"
             → GeocodingResult(45.515200, -122.678400, ...)
    Returns None on empty input, no results, or network error.
    """
    if not address or not address.strip():
        return None

    params = {
        "q": address.strip(),
        "countrycodes": "us",
        "format": "json",
        "limit": "1",
    }
    return await _nominatim_search(params, label=f"address:{address}")


# ── Internal ─────────────────────────────────────────────────────


async def _nominatim_search(
    params: dict, label: str = ""
) -> GeocodingResult | None:
    """Shared Nominatim HTTP call. Returns first result or None."""
    try:
        # TODO: every geocode opens and closes a TCP connection -  ok at a handlful 
        # of provider saves per day scale. If you ever needed high throughput, create 
        # one shared client at app startup and inject it ("client lifecycle management" 
        # pattern in httpx docs)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{NOMINATIM_BASE_URL}/search",
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=TIMEOUT_SECONDS,
            )
            # convert 4xx/5xx to httpx.HTTPError exception ("request failed" 
            # -> "request succeeded but server said no")
            resp.raise_for_status()  
            results = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Nominatim geocode failed for %s: %s", label, exc)
        return None

    if not results:
        return None

    first = results[0]
    return GeocodingResult(
        latitude=float(first["lat"]),  # Nominatim returns strings for lat/lon {"lat": "45.487500", ...}
        longitude=float(first["lon"]),  # dataclass will hold the actual floats
        display_name=first.get("display_name", ""),
    )
