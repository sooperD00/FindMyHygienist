"""
Sprint 5 photo tests — no database required.

Verifies photo validation logic (content type, file size, key generation)
and the PhotoResponse schema. Route-level upload/delete flows are
smoke-tested via Swagger.

Run with:
    cd backend && pytest tests/test_photo.py -v
"""

import pytest

from app.services.photo_service import (
    ALLOWED_CONTENT_TYPES,
    MAX_PHOTO_SIZE,
    _key_from_url,
    detect_image_type,
    photo_key,
    validate_content_type,
    validate_file_size,
)
from app.routes.photo import PhotoResponse


# ── Content type validation ──────────────────────────────────────


class TestValidateContentType:
    """Only JPEG, PNG, and WebP are accepted."""

    def test_jpeg_accepted(self):
        validate_content_type("image/jpeg")  # should not raise

    def test_png_accepted(self):
        validate_content_type("image/png")

    def test_webp_accepted(self):
        validate_content_type("image/webp")

    def test_gif_rejected(self):
        with pytest.raises(ValueError, match="Unsupported image type"):
            validate_content_type("image/gif")

    def test_pdf_rejected(self):
        with pytest.raises(ValueError, match="Unsupported image type"):
            validate_content_type("application/pdf")

    def test_empty_string_rejected(self):
        with pytest.raises(ValueError, match="Unsupported image type"):
            validate_content_type("")

    def test_allowed_set_is_exactly_three(self):
        """Guard against accidentally adding types without tests."""
        assert ALLOWED_CONTENT_TYPES == {"image/jpeg", "image/png", "image/webp"}


# ── File size validation ─────────────────────────────────────────


class TestValidateFileSize:
    """Max 5 MB."""

    def test_small_file_accepted(self):
        validate_file_size(1024)  # 1 KB — should not raise

    def test_exact_limit_accepted(self):
        validate_file_size(MAX_PHOTO_SIZE)  # exactly 5 MB

    def test_over_limit_rejected(self):
        with pytest.raises(ValueError, match="File too large"):
            validate_file_size(MAX_PHOTO_SIZE + 1)

    def test_zero_bytes_accepted(self):
        """Technically valid — an empty file passes size check.
        The content-type check would catch it upstream."""
        validate_file_size(0)

    def test_max_size_is_5mb(self):
        assert MAX_PHOTO_SIZE == 5 * 1024 * 1024


# ── Photo key generation ─────────────────────────────────────────


class TestPhotoKey:
    """Keys follow photos/{provider_id}.{ext} convention."""

    def test_jpeg_key(self):
        assert photo_key("abc-123", "image/jpeg") == "photos/abc-123.jpg"

    def test_png_key(self):
        assert photo_key("abc-123", "image/png") == "photos/abc-123.png"

    def test_webp_key(self):
        assert photo_key("abc-123", "image/webp") == "photos/abc-123.webp"


# ── Key extraction from URL ──────────────────────────────────────


class TestKeyFromUrl:
    """Extract storage key from photo URL for deletion."""

    def test_local_url(self):
        assert _key_from_url("/uploads/photos/abc-123.jpg") == "photos/abc-123.jpg"

    def test_s3_url(self):
        url = "https://bucket.s3.amazonaws.com/photos/abc-123.png"
        assert _key_from_url(url) == "photos/abc-123.png"

    def test_no_photos_marker(self):
        """URLs without 'photos/' return None (e.g., manually set URLs)."""
        assert _key_from_url("https://example.com/image.jpg") is None

    def test_empty_string(self):
        assert _key_from_url("") is None

# ── Magic bytes validation ───────────────────────────────────────


class TestDetectImageType:
    """File content must match JPEG, PNG, or WebP magic bytes."""

    def test_jpeg_magic_accepted(self):
        data = b"\xff\xd8\xff" + b"\x00" * 9
        assert detect_image_type(data) == "image/jpeg"

    def test_png_magic_accepted(self):
        data = b"\x89PNG" + b"\x00" * 8
        assert detect_image_type(data) == "image/png"

    def test_webp_magic_accepted(self):
        data = b"RIFF\x00\x00\x00\x00WEBP"
        assert detect_image_type(data) == "image/webp"

    def test_gif_magic_rejected(self):
        data = b"GIF89a" + b"\x00" * 6
        with pytest.raises(ValueError, match="accepted image format"):
            detect_image_type(data)

    def test_pdf_magic_rejected(self):
        data = b"%PDF-1.4" + b"\x00" * 4
        with pytest.raises(ValueError, match="accepted image format"):
            detect_image_type(data)

    # Short/empty bytes don't need a separate length guard — Python
    # slicing handles them safely (b""[:3] == b"", which won't match
    # any magic signature). They fall through to the same ValueError
    # as any other unrecognized format. The important thing is they
    # don't silently pass or crash.
    def test_empty_bytes_rejected(self):
        with pytest.raises(ValueError, match="accepted image format"):
            detect_image_type(b"")

    def test_short_bytes_rejected(self):
        with pytest.raises(ValueError, match="accepted image format"):
            detect_image_type(b"\xff\xd8")


# ── PhotoResponse schema ─────────────────────────────────────────


class TestPhotoResponse:
    def test_with_url(self):
        r = PhotoResponse(photo_url="/uploads/photos/abc.jpg")
        assert r.photo_url == "/uploads/photos/abc.jpg"

    def test_with_none(self):
        r = PhotoResponse(photo_url=None)
        assert r.photo_url is None
