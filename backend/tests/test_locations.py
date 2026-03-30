"""
Sprint 5 location tests — no database required.

Verifies Pydantic schema validation (request/response shapes, field
presence, type enforcement), the LOCATION_EDITABLE_FIELDS whitelist,
and ADR-013 compliance (public response doesn't leak private fields).

Run with:
    cd backend && pytest tests/test_locations.py -v
"""

import pytest
from pydantic import ValidationError

from app.routes.locations import (
    LocationCreateRequest,
    LocationUpdateRequest,
    OwnLocationResponse,
    PublicLocationResponse,
)
from app.services.location_service import LOCATION_EDITABLE_FIELDS, MAX_LOCATIONS_PER_PROVIDER


# ── LocationCreateRequest schema ─────────────────────────────────


class TestLocationCreateRequest:
    """Label is required; address fields are optional."""

    def test_minimal_location(self):
        """Just a label — valid for a zip-code-only private location."""
        req = LocationCreateRequest(label="Travel base")
        assert req.label == "Travel base"
        assert req.city is None
        assert req.is_public is True  # default

    def test_full_location(self):
        req = LocationCreateRequest(
            label="Main Office",
            practice_name="Pacific Dental Services",
            address_line1="123 Main St",
            city="Portland",
            state="OR",
            zip_code="97201",
            is_primary=True,
            is_public=True,
        )
        assert req.practice_name == "Pacific Dental Services"
        assert req.is_primary is True

    def test_private_location(self):
        """EPDH entering home zip for radius search only."""
        req = LocationCreateRequest(
            label="Home area",
            zip_code="97123",
            is_public=False,
        )
        assert req.is_public is False
        assert req.city is None
        assert req.address_line1 is None

    def test_missing_label_rejected(self):
        with pytest.raises(ValidationError):
            LocationCreateRequest()

    def test_state_defaults_to_OR(self):
        req = LocationCreateRequest(label="Office")
        assert req.state == "OR"

    def test_is_public_defaults_to_true(self):
        req = LocationCreateRequest(label="Office")
        assert req.is_public is True

    def test_is_primary_defaults_to_false(self):
        req = LocationCreateRequest(label="Office")
        assert req.is_primary is False


# ── LocationUpdateRequest schema ─────────────────────────────────


class TestLocationUpdateRequest:
    """All fields optional — uses exclude_unset pattern."""

    def test_empty_update_accepted(self):
        req = LocationUpdateRequest()
        assert req.model_dump(exclude_unset=True) == {}

    def test_single_field_update(self):
        req = LocationUpdateRequest(label="New Label")
        dumped = req.model_dump(exclude_unset=True)
        assert dumped == {"label": "New Label"}
        assert "city" not in dumped

    def test_toggle_is_public(self):
        req = LocationUpdateRequest(is_public=False)
        dumped = req.model_dump(exclude_unset=True)
        assert dumped == {"is_public": False}

    def test_toggle_is_primary(self):
        req = LocationUpdateRequest(is_primary=True)
        dumped = req.model_dump(exclude_unset=True)
        assert dumped == {"is_primary": True}


# ── LOCATION_EDITABLE_FIELDS whitelist ───────────────────────────


class TestLocationEditableFields:
    """The service-layer whitelist controls which ProviderLocation
    columns can be set via POST/PUT."""

    def test_address_fields_included(self):
        expected = {"label", "practice_name", "address_line1", "address_line2",
                    "city", "state", "zip_code", "is_primary", "is_public"}
        assert expected <= LOCATION_EDITABLE_FIELDS

    def test_system_fields_excluded(self):
        """id, provider_id, lat/lng are system-managed."""
        forbidden = {"id", "provider_id", "latitude", "longitude"}
        assert forbidden.isdisjoint(LOCATION_EDITABLE_FIELDS)

    def test_create_schema_aligns_with_whitelist(self):
        """Every field on LocationCreateRequest should be in the whitelist.
        Catches drift — same pattern as test_profile.py."""
        schema_fields = set(LocationCreateRequest.model_fields.keys())
        assert schema_fields <= LOCATION_EDITABLE_FIELDS, (
            f"Schema fields not in LOCATION_EDITABLE_FIELDS: "
            f"{schema_fields - LOCATION_EDITABLE_FIELDS}"
        )

    def test_update_schema_aligns_with_whitelist(self):
        schema_fields = set(LocationUpdateRequest.model_fields.keys())
        assert schema_fields <= LOCATION_EDITABLE_FIELDS, (
            f"Schema fields not in LOCATION_EDITABLE_FIELDS: "
            f"{schema_fields - LOCATION_EDITABLE_FIELDS}"
        )


# ── OwnLocationResponse fields ──────────────────────────────────


class TestOwnLocationResponseFields:
    """Provider sees all fields including address and coordinates."""

    def test_has_address_fields(self):
        for field in ("address_line1", "address_line2", "city", "zip_code"):
            assert field in OwnLocationResponse.model_fields

    def test_has_coordinates(self):
        assert "latitude" in OwnLocationResponse.model_fields
        assert "longitude" in OwnLocationResponse.model_fields

    def test_has_is_public(self):
        assert "is_public" in OwnLocationResponse.model_fields

    def test_has_is_primary(self):
        assert "is_primary" in OwnLocationResponse.model_fields


# ── PublicLocationResponse fields (ADR-013 compliance) ───────────


class TestPublicLocationResponseFields:
    """Patient-facing response: label + city + state ONLY.
    Never leaks street address, zip, or coordinates."""

    def test_has_display_fields(self):
        """The three fields patients should see."""
        assert "label" in PublicLocationResponse.model_fields
        assert "city" in PublicLocationResponse.model_fields
        assert "state" in PublicLocationResponse.model_fields

    def test_no_address_fields(self):
        """Street address never exposed publicly."""
        assert "address_line1" not in PublicLocationResponse.model_fields
        assert "address_line2" not in PublicLocationResponse.model_fields

    def test_no_zip_code(self):
        assert "zip_code" not in PublicLocationResponse.model_fields

    def test_no_coordinates(self):
        """Lat/lng are for search, not display."""
        assert "latitude" not in PublicLocationResponse.model_fields
        assert "longitude" not in PublicLocationResponse.model_fields

    def test_no_is_public(self):
        """Patients don't need to know about the visibility flag."""
        assert "is_public" not in PublicLocationResponse.model_fields

    def test_has_is_primary(self):
        """Primary flag is useful for display ordering on the profile."""
        assert "is_primary" in PublicLocationResponse.model_fields


# ── Profile response includes locations ──────────────────────────


class TestProfileResponseHasLocations:
    """Sprint 5 added locations to both profile responses."""

    def test_own_profile_has_locations(self):
        from app.routes.profile import OwnProfileResponse
        assert "locations" in OwnProfileResponse.model_fields

    def test_public_profile_has_locations(self):
        from app.routes.profile import PublicProfileResponse
        assert "locations" in PublicProfileResponse.model_fields


# ── Constants ────────────────────────────────────────────────────


class TestLocationConstants:
    def test_max_locations_is_10(self):
        assert MAX_LOCATIONS_PER_PROVIDER == 10
