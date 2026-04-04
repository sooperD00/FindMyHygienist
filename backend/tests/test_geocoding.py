"""
Sprint 11 geocoding tests — no database, no network.

Tests the geocoding service (mock Nominatim HTTP responses) and the
_geocode_location helper (strategy selection: full address vs zip-only
vs nothing geocodable).

Run with:
    cd backend && pytest tests/test_geocoding.py -v
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.geocoding_service import (
    GeocodingResult,
    geocode_address,
    geocode_zip,
)
from app.services.location_service import _geocode_location


# ── Fixtures: mock Nominatim responses ───────────────────────────


def _mock_httpx_client(json_response, raise_on_get=None):
    """Build a mock httpx.AsyncClient that returns the given JSON.

    Used as: with patch("httpx.AsyncClient", return_value=client):
    The mock supports `async with httpx.AsyncClient() as client:` usage.
    """
    mock_response = MagicMock()
    mock_response.json.return_value = json_response
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    if raise_on_get:
        mock_client.get = AsyncMock(side_effect=raise_on_get)
    else:
        mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    return mock_client


PORTLAND_ZIP_RESPONSE = [
    {
        "lat": "45.515232",
        "lon": "-122.678383",
        "display_name": "97201, Portland, Multnomah County, Oregon, United States",
    }
]

HILLSBORO_ADDRESS_RESPONSE = [
    {
        "lat": "45.519550",
        "lon": "-122.987080",
        "display_name": "250 SE 10th Ave, Hillsboro, OR 97123, United States",
    }
]


# ── geocode_zip ──────────────────────────────────────────────────


class TestGeocodeZip:
    """Tests for geocoding by US zip code."""

    @pytest.mark.asyncio
    async def test_valid_zip(self):
        """Standard 5-digit zip → returns lat/lng."""
        client = _mock_httpx_client(PORTLAND_ZIP_RESPONSE)
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_zip("97201")

        assert result is not None
        assert result.latitude == pytest.approx(45.515232)
        assert result.longitude == pytest.approx(-122.678383)
        assert "97201" in result.display_name

    @pytest.mark.asyncio
    async def test_zip_with_spaces(self):
        """Spaces stripped before validation."""
        client = _mock_httpx_client(PORTLAND_ZIP_RESPONSE)
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_zip(" 97201 ")

        assert result is not None
        call_args = client.get.call_args
        assert call_args[1]["params"]["postalcode"] == "97201"

    @pytest.mark.asyncio
    async def test_zip_plus_four_accepted(self):
        """ZIP+4 format → extracts 5-digit zip and geocodes it."""
        client = _mock_httpx_client(PORTLAND_ZIP_RESPONSE)
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_zip("97201-1234")

        assert result is not None
        call_args = client.get.call_args
        assert call_args[1]["params"]["postalcode"] == "97201"

    @pytest.mark.asyncio
    async def test_invalid_zip_too_short(self):
        """3-digit input → None, no HTTP call."""
        result = await geocode_zip("971")
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_zip_letters(self):
        """Non-digit characters → None, no HTTP call."""
        result = await geocode_zip("9720A")
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_zip(self):
        """Empty string → None."""
        result = await geocode_zip("")
        assert result is None

    @pytest.mark.asyncio
    async def test_zip_not_found(self):
        """Nominatim returns empty array → None."""
        client = _mock_httpx_client([])
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_zip("00000")

        assert result is None

    @pytest.mark.asyncio
    async def test_network_error(self):
        """HTTP error → None (not an exception)."""
        import httpx
        client = _mock_httpx_client(None, raise_on_get=httpx.ConnectError("connection refused"))
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_zip("97201")

        assert result is None


# ── geocode_address ──────────────────────────────────────────────


class TestGeocodeAddress:
    """Tests for geocoding by freeform address."""

    @pytest.mark.asyncio
    async def test_valid_address(self):
        """Full address → returns lat/lng."""
        client = _mock_httpx_client(HILLSBORO_ADDRESS_RESPONSE)
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_address("250 SE 10th Ave, Hillsboro, OR 97123")

        assert result is not None
        assert result.latitude == pytest.approx(45.519550)
        assert result.longitude == pytest.approx(-122.987080)

    @pytest.mark.asyncio
    async def test_empty_string(self):
        """Empty string → None, no HTTP call."""
        result = await geocode_address("")
        assert result is None

    @pytest.mark.asyncio
    async def test_whitespace_only(self):
        """Whitespace-only → None, no HTTP call."""
        result = await geocode_address("   ")
        assert result is None

    @pytest.mark.asyncio
    async def test_address_not_found(self):
        """Nominatim returns empty array → None."""
        client = _mock_httpx_client([])
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_address("999 Nonexistent St, Nowhere, XX 00000")

        assert result is None

    @pytest.mark.asyncio
    async def test_network_error(self):
        """HTTP timeout → None (not an exception)."""
        import httpx
        client = _mock_httpx_client(None, raise_on_get=httpx.ReadTimeout("timed out"))
        with patch("app.services.geocoding_service.httpx.AsyncClient", return_value=client):
            result = await geocode_address("250 SE 10th Ave, Hillsboro, OR")

        assert result is None


# ── _geocode_location (strategy selection) ───────────────────────


class TestGeocodeLocationHelper:
    """Tests for the _geocode_location helper that picks
    full-address vs zip-only vs no-geocoding strategy."""

    @pytest.mark.asyncio
    async def test_full_address_preferred(self):
        """When address + city + zip all present, geocode_address is called."""
        mock_result = GeocodingResult(45.519550, -122.987080, "Hillsboro")
        with patch("app.services.location_service.geocoding_service.geocode_address", new_callable=AsyncMock, return_value=mock_result) as mock_addr:
            lat, lng = await _geocode_location({
                "address_line1": "250 SE 10th Ave",
                "city": "Hillsboro",
                "state": "OR",
                "zip_code": "97123",
            })

        assert lat == pytest.approx(45.519550)
        assert lng == pytest.approx(-122.987080)
        mock_addr.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_zip_only_fallback(self):
        """No street address → falls back to geocode_zip."""
        mock_result = GeocodingResult(45.515232, -122.678383, "97201")
        with patch("app.services.location_service.geocoding_service.geocode_zip", new_callable=AsyncMock, return_value=mock_result) as mock_zip:
            lat, lng = await _geocode_location({
                "zip_code": "97201",
            })

        assert lat == pytest.approx(45.515232)
        assert lng == pytest.approx(-122.678383)
        mock_zip.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_address_fails_falls_back_to_zip(self):
        """geocode_address returns None → tries geocode_zip."""
        mock_zip_result = GeocodingResult(45.515232, -122.678383, "97201")
        with (
            patch("app.services.location_service.geocoding_service.geocode_address", new_callable=AsyncMock, return_value=None),
            patch("app.services.location_service.geocoding_service.geocode_zip", new_callable=AsyncMock, return_value=mock_zip_result) as mock_zip,
        ):
            lat, lng = await _geocode_location({
                "address_line1": "250 SE 10th Ave",
                "city": "Hillsboro",
                "state": "OR",
                "zip_code": "97123",
            })

        assert lat == pytest.approx(45.515232)
        mock_zip.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_geocodable_fields(self):
        """Label only, no address or zip → (None, None)."""
        lat, lng = await _geocode_location({
            "label": "Travel base",
        })

        assert lat is None
        assert lng is None

    @pytest.mark.asyncio
    async def test_address_line2_included(self):
        """address_line2 is included in the composed address string in the correct position."""
        mock_result = GeocodingResult(45.0, -122.0, "test")
        with patch("app.services.location_service.geocoding_service.geocode_address", new_callable=AsyncMock, return_value=mock_result) as mock_addr:
            await _geocode_location({
                "address_line1": "250 SE 10th Ave",
                "address_line2": "Suite 200",
                "city": "Hillsboro",
                "state": "OR",
                "zip_code": "97123",
            })

        # Verify the full composed address has the right parts and the parts are in the right order
        # a bit brittle — if you later add a comma style change or different separator, the test breaks 
        # even though geocoding would still work fine. At your stage that's a feature, not a bug. You 
        # want to know when the string composition changes
        call_args = mock_addr.call_args[0][0]
        assert call_args == "250 SE 10th Ave, Suite 200, Hillsboro, OR, 97123"

    @pytest.mark.asyncio
    async def test_address_with_zip_no_city(self):
        """Street + zip but no city → still tries geocode_address."""
        mock_result = GeocodingResult(45.0, -122.0, "test")
        with patch("app.services.location_service.geocoding_service.geocode_address", new_callable=AsyncMock, return_value=mock_result) as mock_addr:
            lat, lng = await _geocode_location({
                "address_line1": "250 SE 10th Ave",
                "state": "OR",
                "zip_code": "97123",
            })

        assert lat == pytest.approx(45.0)
        mock_addr.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_both_fail_returns_none(self):
        """Both geocode_address and geocode_zip return None → (None, None)."""
        with (
            patch("app.services.location_service.geocoding_service.geocode_address", new_callable=AsyncMock, return_value=None),
            patch("app.services.location_service.geocoding_service.geocode_zip", new_callable=AsyncMock, return_value=None),
        ):
            lat, lng = await _geocode_location({
                "address_line1": "999 Fake St",
                "city": "Nowhere",
                "state": "OR",
                "zip_code": "00000",
            })

        assert lat is None
        assert lng is None
