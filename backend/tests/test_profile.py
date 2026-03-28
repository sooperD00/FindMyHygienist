"""
Sprint 4 profile tests — no database required.

Verifies Pydantic schema validation (request/response shapes, field
presence, type enforcement), the EDITABLE_FIELDS whitelist, and draft
serialization logic. Route-level flows are smoke-tested via Swagger.

Run with:
    cd backend && pytest tests/test_profile.py -v
"""

import uuid

import pytest
from pydantic import ValidationError

from app.routes.profile import (
    CredentialResponse,
    CredentialUpdateRequest,
    OwnProfileResponse,
    ProfileUpdateRequest,
    PublicProfileResponse,
)
from app.services.profile_service import EDITABLE_FIELDS


# ── CredentialResponse schema ─────────────────────────────────────


class TestCredentialResponse:
    """The credential chip data shape — code + full_name +
    patient_description + credential_type."""

    def test_valid_credential(self):
        c = CredentialResponse(
            code="RDH",
            full_name="Registered Dental Hygienist",
            patient_description="Licensed to provide cleanings...",
            credential_type="LICENSE",
        )
        assert c.code == "RDH"
        assert c.credential_type == "LICENSE"

    def test_missing_required_field_rejected(self):
        with pytest.raises(ValidationError):
            CredentialResponse(
                code="RDH",
                full_name="Registered Dental Hygienist",
                # missing patient_description and credential_type
            )

    def test_invalid_credential_type_rejected(self):
        with pytest.raises(ValidationError):
            CredentialResponse(
                code="RDH",
                full_name="Registered Dental Hygienist",
                patient_description="...",
                credential_type="INVALID_TYPE",
            )


# ── ProfileUpdateRequest schema ───────────────────────────────────


class TestProfileUpdateRequest:
    """All fields are optional — provider sends only what changed."""

    def test_empty_body_accepted(self):
        """An empty update is valid (no-op)."""
        req = ProfileUpdateRequest()
        assert req.model_dump(exclude_unset=True) == {}

    def test_single_field_update(self):
        req = ProfileUpdateRequest(bio="I love teeth")
        dumped = req.model_dump(exclude_unset=True)
        assert dumped == {"bio": "I love teeth"}
        # Other fields should NOT appear when using exclude_unset
        assert "phone" not in dumped

    def test_multiple_fields_update(self):
        req = ProfileUpdateRequest(
            bio="I love teeth",
            languages=["English", "Spanish"],
            accepting_new_patients=False,
        )
        dumped = req.model_dump(exclude_unset=True)
        assert len(dumped) == 3
        assert dumped["languages"] == ["English", "Spanish"]
        assert dumped["accepting_new_patients"] is False

    def test_enum_field_accepted(self):
        req = ProfileUpdateRequest(availability="MOBILE")
        dumped = req.model_dump(exclude_unset=True)
        assert dumped["availability"].value == "MOBILE"

    def test_invalid_enum_rejected(self):
        with pytest.raises(ValidationError):
            ProfileUpdateRequest(availability="TELEHEALTH")

    def test_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            ProfileUpdateRequest(public_email="not-an-email")

    def test_valid_email_accepted(self):
        req = ProfileUpdateRequest(public_email="hygienist@example.com")
        dumped = req.model_dump(exclude_unset=True)
        assert "public_email" in dumped


# ── CredentialUpdateRequest schema ────────────────────────────────


class TestCredentialUpdateRequest:
    """The codes field is required — it replaces the full list."""

    def test_valid_codes(self):
        req = CredentialUpdateRequest(codes=["RDH", "BSDH", "LAP"])
        assert req.codes == ["RDH", "BSDH", "LAP"]

    def test_empty_list_accepted(self):
        """A provider might want to clear all credentials."""
        req = CredentialUpdateRequest(codes=[])
        assert req.codes == []

    def test_missing_codes_rejected(self):
        with pytest.raises(ValidationError):
            CredentialUpdateRequest()


# ── EDITABLE_FIELDS whitelist ─────────────────────────────────────


class TestEditableFields:
    """The service-layer whitelist controls which Provider columns
    can be updated via PUT /api/me/profile."""

    def test_profile_fields_included(self):
        """Core profile fields should all be editable."""
        expected_editable = {
            "bio",
            "title_line",
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
        assert expected_editable <= EDITABLE_FIELDS

    def test_admin_fields_excluded(self):
        """Admin-controlled fields must NOT be in EDITABLE_FIELDS."""
        forbidden = {"status", "auto_approved", "reviewed_by", "reviewed_at"}
        assert forbidden.isdisjoint(EDITABLE_FIELDS)

    def test_identity_fields_excluded(self):
        """Slug and IDs are system-generated, not provider-editable."""
        forbidden = {"id", "user_id", "slug"}
        assert forbidden.isdisjoint(EDITABLE_FIELDS)

    def test_request_schema_aligns_with_whitelist(self):
        """Every field on ProfileUpdateRequest should be in EDITABLE_FIELDS.
        Catches drift — if someone adds a field to the schema but forgets
        the whitelist, this test fails."""
        schema_fields = set(ProfileUpdateRequest.model_fields.keys())
        assert schema_fields <= EDITABLE_FIELDS, (
            f"Schema fields not in EDITABLE_FIELDS: "
            f"{schema_fields - EDITABLE_FIELDS}"
        )


# ── Response schema field presence ────────────────────────────────


class TestOwnProfileResponseFields:
    """OwnProfileResponse includes draft and status (provider needs
    to see where they stand). Excludes reviewed_by (admin UUID that
    means nothing to the provider)."""

    def test_has_draft_field(self):
        assert "draft" in OwnProfileResponse.model_fields

    def test_has_status_field(self):
        assert "status" in OwnProfileResponse.model_fields

    def test_has_credentials_field(self):
        assert "credentials" in OwnProfileResponse.model_fields

    def test_no_reviewed_by_field(self):
        """reviewed_by is an admin UUID — excluded from provider view."""
        assert "reviewed_by" not in OwnProfileResponse.model_fields

    def test_no_user_id_field(self):
        """Provider already knows who they are."""
        assert "user_id" not in OwnProfileResponse.model_fields


class TestPublicProfileResponseFields:
    """PublicProfileResponse omits private/admin metadata."""

    def test_has_credentials_field(self):
        assert "credentials" in PublicProfileResponse.model_fields

    def test_no_draft_field(self):
        assert "draft" not in PublicProfileResponse.model_fields

    def test_no_status_field(self):
        """Public profiles are always APPROVED — no need to expose."""
        assert "status" not in PublicProfileResponse.model_fields

    def test_no_reviewed_at_field(self):
        assert "reviewed_at" not in PublicProfileResponse.model_fields

    def test_no_user_id_field(self):
        assert "user_id" not in PublicProfileResponse.model_fields


# ── Draft serialization ──────────────────────────────────────────


class TestDraftEnumSerialization:
    """When updates go to the draft JSON column, enums must be
    serialized to their string values (JSON can't store Python
    enum objects)."""

    def test_enum_has_value_attribute(self):
        """Sanity check that hasattr(enum, 'value') works for
        the serialization guard in profile_service."""
        from app.models.enums import Availability, ProviderType

        assert hasattr(Availability.MOBILE, "value")
        assert Availability.MOBILE.value == "MOBILE"
        assert hasattr(ProviderType.DENTIST, "value")
        assert ProviderType.DENTIST.value == "DENTIST"

    def test_plain_string_no_value_attribute(self):
        """Plain strings don't have .value — the serialization guard
        should pass them through unchanged."""
        assert not hasattr("hello", "value")
