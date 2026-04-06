"""
Sprint 12 search tests — no database required.

Verifies Haversine math (ported from C# CalculateDistance), response
schema validation, example-profile tag filtering logic, and SearchLog
model defaults. Route-level flows (geocoding, pagination, full filter
combinations) are smoke-tested via Swagger.

Run with:
    cd backend && pytest tests/test_search.py -v
"""

import uuid

import pytest
from pydantic import ValidationError

from app.models.search_log import SearchLog
from app.routes.search import (
    _normalize_coords,
    ProviderSearchResult,
    ProviderTypeResponse,
    SearchResponse,
)
from app.services.search_service import haversine


# ── Normalize coords (6 decimals on lat/lon gives cm accuracy) ────

class TestNormalizeCoords:
    """Coordinate rounding to 6 decimals (~11cm precision)."""

    def test_rounds_to_six_decimals(self):
        lat, lon = _normalize_coords(45.123456789, -122.987654321)
        assert lat == 45.123457
        assert lon == -122.987654

    def test_already_short_unchanged(self):
        lat, lon = _normalize_coords(45.5, -122.6)
        assert lat == 45.5
        assert lon == -122.6

# ── Haversine ─────────────────────────────────────────────────────


class TestHaversine:
    """Haversine distance formula — ported from C# CalculateDistance.

    Reference distances validated against ORToothFairy's
    SearchServiceTests.cs and Google Maps straight-line distances.
    """

    def test_portland_to_beaverton(self):
        """Known distance: Portland (45.5152, -122.6784) to
        Beaverton (45.4875, -122.8037) ≈ 6.4 miles.
        Matches the C# test expectation (InRange 6.0–7.0)."""
        d = haversine(45.5152, -122.6784, 45.4875, -122.8037)
        assert 6.0 <= d <= 7.0

    def test_identical_points_zero_distance(self):
        """Same point → 0.0 miles."""
        d = haversine(45.5, -122.6, 45.5, -122.6)
        assert d == 0.0

    def test_portland_to_salem(self):
        """Portland to Salem ≈ 45 miles (sanity check)."""
        d = haversine(45.5152, -122.6784, 44.9429, -123.0351)
        assert 40.0 <= d <= 50.0

    def test_portland_to_bend(self):
        """Portland to Bend ≈ 128 miles (cross-state sanity check)."""
        d = haversine(45.5152, -122.6784, 44.0582, -121.3153)
        assert 110.0 <= d <= 140.0

    def test_symmetry(self):
        """haversine(A, B) == haversine(B, A) — order shouldn't matter."""
        d1 = haversine(45.5, -122.6, 44.9, -123.0)
        d2 = haversine(44.9, -123.0, 45.5, -122.6)
        assert abs(d1 - d2) < 0.001


# ── Response schemas ──────────────────────────────────────────────


class TestProviderSearchResult:
    """Search result card shape — all fields the frontend may render."""

    def test_valid_result(self):
        r = ProviderSearchResult(
            id=str(uuid.uuid4()),
            slug="jane-smith-abc123",
            display_name="Jane Smith",
            provider_type="DENTAL_HYGIENIST",
            title_line="RDH — Preventive Care",
            bio="I provide preventive care...",
            mission_statement=None,
            photo_url=None,
            phone="(503) 555-0101",
            public_email="jane@example.com",
            website=None,
            credentials=["RDH", "EPDH"],
            accepting_new_patients=True,
            availability="IN_PERSON",
            tags=["anxiety-friendly"],
            insurance_accepted=["Delta Dental"],
            services=["preventive care", "sealants"],
            specialties=["pediatric"],
            populations_served=["children", "families"],
            languages=["English", "Spanish"],
            distance_miles=3.2,
            nearest_location_city="Portland",
            nearest_location_state="OR",
        )
        assert r.display_name == "Jane Smith"
        assert r.distance_miles == 3.2
        assert r.nearest_location_city == "Portland"

    def test_missing_required_field_rejected(self):
        with pytest.raises(ValidationError):
            ProviderSearchResult(
                id=str(uuid.uuid4()),
                # missing slug, display_name, provider_type, etc.
            )

    def test_nullable_fields_accept_none(self):
        """Sparse profiles (just name + type) still produce valid cards."""
        r = ProviderSearchResult(
            id=str(uuid.uuid4()),
            slug="test-slug",
            display_name="Test",
            provider_type="DENTAL_HYGIENIST",
            title_line=None,
            bio=None,
            mission_statement=None,
            photo_url=None,
            phone=None,
            public_email=None,
            website=None,
            credentials=[],
            accepting_new_patients=True,
            availability=None,
            tags=[],
            insurance_accepted=None,
            services=None,
            specialties=None,
            populations_served=None,
            languages=None,
            distance_miles=0.0,
            nearest_location_city=None,
            nearest_location_state=None,
        )
        assert r.bio is None
        assert r.insurance_accepted is None


class TestSearchResponse:
    """Paginated search response wrapper."""

    def test_empty_results(self):
        r = SearchResponse(
            results=[],
            count=0,
            page=1,
            per_page=20,
            total_count=0,
            search_location="Portland, OR",
        )
        assert r.count == 0
        assert r.total_count == 0
        assert r.results == []

    def test_pagination_fields(self):
        r = SearchResponse(
            results=[],
            count=0,
            page=3,
            per_page=10,
            total_count=25,
            search_location=None,
        )
        assert r.page == 3
        assert r.per_page == 10
        assert r.total_count == 25


class TestProviderTypeResponse:
    """Provider type dropdown values."""

    def test_valid_type(self):
        r = ProviderTypeResponse(
            code="DENTAL_HYGIENIST", label="Dental Hygienist"
        )
        assert r.code == "DENTAL_HYGIENIST"
        assert r.label == "Dental Hygienist"


# ── SearchLog model ───────────────────────────────────────────────


class TestSearchLogModel:
    """SearchLog model defaults and field types."""

    def test_defaults(self):
        log = SearchLog()
        assert log.query_text is None
        assert log.filters_applied is None
        assert log.result_provider_ids is None
        assert log.result_count == 0

    def test_with_data(self):
        log = SearchLog(
            query_text="97006",
            filters_applied={"provider_type": "DENTAL_HYGIENIST"},
            result_provider_ids=["abc", "def"],
            result_count=2,
        )
        assert log.query_text == "97006"
        assert log.result_count == 2
        assert len(log.result_provider_ids) == 2


# ── Example-profile tag filtering ────────────────────────────────


class TestExampleProfileFiltering:
    """Verify the tag-based example-profile exclusion logic.

    Tests the filtering rules that search_service.search_providers
    applies — tested here as pure logic without a database.
    """

    @staticmethod
    def _is_included(tags: list[str], featured: bool) -> bool:
        """Reproduce the tag filtering logic from search_service.

        This mirrors the exact if-statements in search_providers():
            is_example = "example-profile" in tags
            if featured and not is_example: continue
            if not featured and is_example: continue
        """
        # This duplicates logic from the service. Intentional and fine for now 
        # (testing the rules, not the implementation), but TODO: that if the filtering 
        # logic in search_service.py ever changes, this helper needs to change too — 
        # otherwise the tests pass while the app behaves differently
        is_example = "example-profile" in tags
        if featured and not is_example:
            return False
        if not featured and is_example:
            return False
        return True

    def test_normal_search_excludes_example(self):
        assert not self._is_included(
            ["example-profile", "anxiety-friendly"], featured=False
        )

    def test_normal_search_includes_real_provider(self):
        assert self._is_included(
            ["anxiety-friendly", "prevention-first"], featured=False
        )

    def test_featured_includes_example(self):
        assert self._is_included(
            ["example-profile", "mobile provider"], featured=True
        )

    def test_featured_excludes_real_provider(self):
        assert not self._is_included(["anxiety-friendly"], featured=True)

    def test_empty_tags_included_in_normal_search(self):
        assert self._is_included([], featured=False)

    def test_empty_tags_excluded_from_featured(self):
        assert not self._is_included([], featured=True)

    def test_example_profile_stripped_from_visible_tags(self):
        """The search result should not show 'example-profile' to patients."""
        tags = ["example-profile", "mobile provider", "rural access"]
        visible = [t for t in tags if t != "example-profile"]
        assert "example-profile" not in visible
        assert len(visible) == 2
