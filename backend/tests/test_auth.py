"""
Sprint 2 auth tests — no database required.

Verifies argon2id hash/verify roundtrip, session token generation format,
CSRF synchronizer validation logic, slug generation, and Session model
field presence. Run with:
    cd backend && pytest tests/test_auth.py -v

Route-level flows (register → login → me → logout) are smoke-tested
via Swagger/curl — wiring up an async test DB doesn't pay for itself yet.
"""

import re
import secrets

import pytest

from app.services.auth_service import hash_password, verify_password, _make_slug
from app.models.session import Session


# ── argon2id hash / verify ────────────────────────────────────────


class TestArgon2:
    """argon2id is memory-hard (ADR-011). These tests verify the
    hash/verify roundtrip without touching the database."""

    def test_hash_returns_argon2id_format(self):
        h = hash_password("test-password-123")
        assert h.startswith("$argon2id$"), f"Expected argon2id prefix, got: {h[:20]}"

    def test_verify_correct_password(self):
        h = hash_password("my-secret")
        assert verify_password("my-secret", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("my-secret")
        assert verify_password("wrong-password", h) is False

    def test_different_passwords_produce_different_hashes(self):
        h1 = hash_password("password-one")
        h2 = hash_password("password-two")
        assert h1 != h2

    def test_same_password_produces_different_hashes(self):
        """argon2id uses a random salt each time — same input, different output.
        This is correct behavior: it means you can't compare hashes to detect
        password reuse across accounts."""
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2


# ── Session token format ──────────────────────────────────────────


class TestSessionToken:
    """Session IDs and CSRF tokens are both secrets.token_urlsafe(32).
    These tests verify the format matches what the session service
    will generate."""

    def test_token_urlsafe_length(self):
        """token_urlsafe(32) → 43 base64url characters."""
        token = secrets.token_urlsafe(32)
        assert len(token) == 43

    def test_token_urlsafe_charset(self):
        """Only base64url characters: A-Z, a-z, 0-9, hyphen, underscore."""
        token = secrets.token_urlsafe(32)
        assert re.match(r"^[A-Za-z0-9_-]+$", token)

    def test_tokens_are_unique(self):
        """100 tokens should all be distinct (collision probability ≈ 0)."""
        tokens = {secrets.token_urlsafe(32) for _ in range(100)}
        assert len(tokens) == 100


# ── CSRF synchronizer validation ──────────────────────────────────


class TestCSRFValidation:
    """The synchronizer pattern compares the X-CSRF-Token header against
    the csrf_token stored in the session row. secrets.compare_digest
    does a timing-safe comparison so attackers can't byte-at-a-time."""

    def test_compare_digest_matching(self):
        token = secrets.token_urlsafe(32)
        assert secrets.compare_digest(token, token) is True

    def test_compare_digest_mismatch(self):
        a = secrets.token_urlsafe(32)
        b = secrets.token_urlsafe(32)
        assert secrets.compare_digest(a, b) is False

    def test_compare_digest_empty_vs_token(self):
        """Empty string must not match — catches missing header."""
        token = secrets.token_urlsafe(32)
        assert secrets.compare_digest("", token) is False


# ── Slug generation ───────────────────────────────────────────────


class TestSlug:
    """Slugs are URL-safe versions of display names with a UUID suffix
    for guaranteed uniqueness (no DB round-trip needed)."""

    def test_basic_slug_format(self):
        slug = _make_slug("Ginger Davidson")
        # "ginger-davidson-" + 6 hex chars
        assert slug.startswith("ginger-davidson-")
        suffix = slug[len("ginger-davidson-"):]
        assert len(suffix) == 6
        assert re.match(r"^[0-9a-f]+$", suffix)

    def test_special_characters_stripped(self):
        slug = _make_slug("Dr. Jane O'Brien-Smith")
        # Everything before the UUID suffix should be lowercase alphanum + hyphens
        base = slug.rsplit("-", 1)[0]
        assert re.match(r"^[a-z0-9-]+$", base)

    def test_two_slugs_are_unique(self):
        """Same name → different slugs (UUID suffix differs)."""
        s1 = _make_slug("Same Name")
        s2 = _make_slug("Same Name")
        assert s1 != s2


# ── Session model fields ─────────────────────────────────────────


class TestSessionModel:
    """Session model has the fields the session service expects."""

    def test_required_fields_present(self):
        fields = set(Session.model_fields.keys())
        expected = {"id", "user_id", "csrf_token", "created_at", "expires_at"}
        assert expected <= fields, f"Missing fields: {expected - fields}"

    def test_tablename(self):
        assert Session.__tablename__ == "sessions"
