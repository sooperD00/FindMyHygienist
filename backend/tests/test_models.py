"""
Sprint 1 model tests — no database required.

Verifies enum completeness, model defaults, credentials.json integrity,
and basic field presence. Run with:
    cd backend && pytest tests/test_models.py -v
"""

import json
import uuid
from pathlib import Path

import pytest

from app.models.enums import (
    Availability,
    CredentialType,
    FeedbackType,
    ProviderStatus,
    ProviderType,
    UserRole,
)
from app.models.user import User
from app.models.credential import Credential
from app.models.provider import Provider, ProviderCredential, ProviderLocation
from app.models.feedback import Feedback


# ── credentials.json path ──────────────────────────────────────────

CREDENTIALS_FILE = Path(__file__).parent.parent / "app" / "data" / "credentials.json"


# ── Enum completeness ──────────────────────────────────────────────
"""
Catches accidental additions or deletions. When the set comparison fails 
it tells you exactly which enum changed and how. Without it, you'd only 
discover a bad enum value at migration time or — worse — at runtime when 
a query filters on a status that doesn't exist.

The cost of a wrong enum in a database migration is an ALTER TYPE on a 
production Postgres table, which takes a lock on every row that uses it. 
Much cheaper to type the list twice.
"""
class TestEnums:
    def test_user_role_values(self):
        assert set(UserRole) == {UserRole.PROVIDER, UserRole.ADMIN}

    def test_credential_type_values(self):
        assert set(CredentialType) == {
            CredentialType.LICENSE,
            CredentialType.DEGREE,
            CredentialType.PERMIT,
            CredentialType.SPECIALTY,
        }

    def test_provider_type_values(self):
        expected = {
            ProviderType.DENTAL_HYGIENIST,
            ProviderType.DENTIST,
            ProviderType.DENTAL_THERAPIST,
            ProviderType.DENTAL_ASSISTANT,
            ProviderType.OTHER,
        }
        assert set(ProviderType) == expected

    def test_provider_status_values(self):
        expected = {
            ProviderStatus.PENDING,
            ProviderStatus.APPROVED,
            ProviderStatus.CHANGES_REQUESTED,
            ProviderStatus.SUSPENDED,
        }
        assert set(ProviderStatus) == expected

    def test_availability_values(self):
        expected = {
            Availability.IN_PERSON,
            Availability.MOBILE,
            Availability.BOTH,
        }
        assert set(Availability) == expected

    def test_feedback_type_values(self):
        assert set(FeedbackType) == {
            FeedbackType.REPORT_ISSUE,
            FeedbackType.GENERAL_FEEDBACK,
        }

    def test_all_enums_are_str_enums(self):
        """ 
        Every enum value should be usable as a string (str, Enum mixin).
        Catches the structural bug where someone forgets the (str, enum.Enum) 
        mixin, which would make SQLAlchemy store integer indices instead of 
        readable strings in Postgres. That's a nasty silent data corruption bug.
        """
        for enum_cls in [
            UserRole,
            CredentialType,
            ProviderType,
            ProviderStatus,
            Availability,
            FeedbackType,
        ]:
            for member in enum_cls:
                assert isinstance(member.value, str), (
                    f"{enum_cls.__name__}.{member.name} value is not a string"
                )


# ── credentials.json integrity ─────────────────────────────────────


class TestCredentialsJson:
    @pytest.fixture()
    def raw_credentials(self):
        assert CREDENTIALS_FILE.exists(), f"Missing: {CREDENTIALS_FILE}"
        return json.loads(CREDENTIALS_FILE.read_text())

    def test_file_parses(self, raw_credentials):
        assert isinstance(raw_credentials, list)

    def test_exactly_17_entries(self, raw_credentials):
        assert len(raw_credentials) == 17

    def test_all_entries_have_required_fields(self, raw_credentials):
        required = {"code", "full_name", "patient_description", "credential_type"}
        for entry in raw_credentials:
            missing = required - set(entry.keys())
            assert not missing, (
                f"Entry {entry.get('code', '???')} missing fields: {missing}"
            )

    def test_no_empty_strings(self, raw_credentials):
        for entry in raw_credentials:
            for key in ("code", "full_name", "patient_description", "credential_type"):
                assert entry[key].strip(), (
                    f"Entry {entry.get('code', '???')} has empty {key}"
                )

    def test_credential_types_are_valid_enum_values(self, raw_credentials):
        valid_types = {member.value for member in CredentialType}
        for entry in raw_credentials:
            assert entry["credential_type"] in valid_types, (
                f"Entry {entry['code']} has invalid credential_type: "
                f"{entry['credential_type']}"
            )

    def test_codes_are_unique(self, raw_credentials):
        codes = [entry["code"] for entry in raw_credentials]
        assert len(codes) == len(set(codes)), "Duplicate credential codes found"

    def test_expected_codes_present(self, raw_credentials):
        """Spot-check that key Oregon credentials made it into the file."""
        codes = {entry["code"] for entry in raw_credentials}
        for expected in ("RDH", "EPDH", "DDS", "DMD", "LAP", "DT", "BSDH"):
            assert expected in codes, f"Expected credential {expected} not found"


# ── Model instantiation & defaults ─────────────────────────────────


class TestUserModel:
    def test_instantiation(self):
        user = User(
            email="test@example.com",
            password_hash="fakehash",
            role=UserRole.PROVIDER,
        )
        assert user.email == "test@example.com"
        assert user.role == UserRole.PROVIDER

    def test_is_active_defaults_true(self):
        user = User(
            email="test@example.com",
            password_hash="fakehash",
            role=UserRole.ADMIN,
        )
        assert user.is_active is True

    def test_id_is_uuid(self):
        user = User(
            email="test@example.com",
            password_hash="fakehash",
            role=UserRole.PROVIDER,
        )
        assert isinstance(user.id, uuid.UUID)


class TestCredentialModel:
    def test_instantiation(self):
        cred = Credential(
            code="RDH",
            full_name="Registered Dental Hygienist",
            patient_description="Licensed to provide cleanings.",
            credential_type=CredentialType.LICENSE,
        )
        assert cred.code == "RDH"
        assert cred.credential_type == CredentialType.LICENSE


class TestProviderModel:
    def test_status_defaults_to_pending(self):
        provider = Provider(
            user_id=uuid.uuid4(),
            display_name="Test Provider",
            slug="test-provider",
            provider_type=ProviderType.DENTAL_HYGIENIST,
        )
        assert provider.status == ProviderStatus.PENDING

    def test_boolean_defaults(self):
        provider = Provider(
            user_id=uuid.uuid4(),
            display_name="Test Provider",
            slug="test-provider",
            provider_type=ProviderType.DENTAL_HYGIENIST,
        )
        assert provider.accepting_new_patients is True
        assert provider.accepts_calls is True
        assert provider.accepts_texts is False
        assert provider.auto_approved is False

    def test_nullable_fields_default_to_none(self):
        provider = Provider(
            user_id=uuid.uuid4(),
            display_name="Test Provider",
            slug="test-provider",
            provider_type=ProviderType.DENTAL_HYGIENIST,
        )
        assert provider.bio is None
        assert provider.mission_statement is None
        assert provider.photo_url is None
        assert provider.phone is None
        assert provider.max_travel_miles is None
        assert provider.draft is None
        assert provider.reviewed_by is None

    def test_id_is_uuid(self):
        provider = Provider(
            user_id=uuid.uuid4(),
            display_name="Test Provider",
            slug="test-provider",
            provider_type=ProviderType.DENTAL_HYGIENIST,
        )
        assert isinstance(provider.id, uuid.UUID)


class TestProviderCredentialModel:
    def test_instantiation(self):
        pid = uuid.uuid4()
        pc = ProviderCredential(provider_id=pid, credential_code="RDH")
        assert pc.provider_id == pid
        assert pc.credential_code == "RDH"


class TestProviderLocationModel:
    def test_defaults(self):
        loc = ProviderLocation(
            provider_id=uuid.uuid4(),
            label="Main Office",
            city="Portland",
        )
        assert loc.state == "OR"
        assert loc.is_primary is False
        assert loc.practice_name is None
        assert loc.address_line2 is None
        assert isinstance(loc.id, uuid.UUID)


class TestFeedbackModel:
    def test_defaults(self):
        fb = Feedback(
            type=FeedbackType.GENERAL_FEEDBACK,
            message="Great site!",
        )
        assert fb.resolved is False
        assert fb.provider_id is None
        assert fb.reporter_email is None
        assert isinstance(fb.id, uuid.UUID)
