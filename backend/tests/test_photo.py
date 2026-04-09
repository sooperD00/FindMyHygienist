"""
Photo tests — no database, no S3 bucket required.

Sprint 5: validates photo validation logic (content type, file size, key
generation) and the PhotoResponse schema.

Sprint 15: adds S3StorageBackend unit tests (mocked boto3) and
get_storage_backend routing tests.

Run with:
    cd backend && pytest tests/test_photo.py -v
"""

import pytest
from unittest.mock import MagicMock, patch

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

    def test_r2_url(self):
        url = "https://pub-abc123.r2.dev/photos/abc-123.webp"
        assert _key_from_url(url) == "photos/abc-123.webp"

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

# ── Avatar generation (Sprint 15, seed_demo.py) ─────────────────


class TestGenerateAvatarPng:
    """Smoke tests for placeholder avatar generation."""

    def test_returns_valid_png(self):
        from app.seed_demo import _generate_avatar_png
        data = _generate_avatar_png("JM", "#4A90D9")
        assert data[:4] == b"\x89PNG"

    def test_returns_bytes(self):
        from app.seed_demo import _generate_avatar_png
        data = _generate_avatar_png("EV", "#C25B56")
        assert isinstance(data, bytes)
        assert len(data) > 0

    def test_get_initials_strips_example_prefix(self):
        from app.seed_demo import _get_initials
        assert _get_initials("[Example] Jenna Morris") == "JM"

    def test_get_initials_plain_name(self):
        from app.seed_demo import _get_initials
        assert _get_initials("Elena Vega") == "EV"

    def test_get_initials_single_name(self):
        from app.seed_demo import _get_initials
        assert _get_initials("Dana") == "D"


# ── S3StorageBackend (Sprint 15) ─────────────────────────────────
# Mocked boto3 — no real bucket needed. Verifies the backend calls
# put_object/delete_object with correct params and returns the
# expected public URL.


class TestS3StorageBackend:
    """Unit tests for S3StorageBackend with mocked boto3 client."""

    @pytest.fixture
    def mock_s3_client(self):
        return MagicMock()

    # patch boto3.client itself instead of the b.client = mock_s3_client after __init__ trick
    # in case you run tests in a locked-down CI environment without AWS config
    @pytest.fixture
    def backend(self, mock_s3_client):
        with patch("app.services.storage.boto3.client", return_value=mock_s3_client):
            from app.services.storage import S3StorageBackend
            b = S3StorageBackend(
                endpoint_url="https://fake.r2.cloudflarestorage.com",
                access_key_id="fake-key",
                secret_access_key="fake-secret",
                bucket_name="test-bucket",
                public_url="https://pub-test.r2.dev",
            )
        return b

    @pytest.mark.asyncio
    async def test_upload_calls_put_object(self, backend, mock_s3_client):
        data = b"\x89PNG" + b"\x00" * 100
        url = await backend.upload(data, "photos/abc-123.png")

        mock_s3_client.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="photos/abc-123.png",
            Body=data,
            ContentType="image/png",
        )
        assert url == "https://pub-test.r2.dev/photos/abc-123.png"

    @pytest.mark.asyncio
    async def test_upload_jpeg_content_type(self, backend, mock_s3_client):
        data = b"\xff\xd8\xff" + b"\x00" * 100
        await backend.upload(data, "photos/abc-123.jpg")

        call_kwargs = mock_s3_client.put_object.call_args[1]
        assert call_kwargs["ContentType"] == "image/jpeg"

    @pytest.mark.asyncio
    async def test_upload_webp_content_type(self, backend, mock_s3_client):
        await backend.upload(b"\x00" * 100, "photos/abc-123.webp")

        call_kwargs = mock_s3_client.put_object.call_args[1]
        assert call_kwargs["ContentType"] == "image/webp"

    @pytest.mark.asyncio
    async def test_upload_unknown_ext_fallback(self, backend, mock_s3_client):
        """Unknown extension → application/octet-stream (safe default)."""
        await backend.upload(b"\x00" * 10, "photos/abc-123.bmp")

        call_kwargs = mock_s3_client.put_object.call_args[1]
        assert call_kwargs["ContentType"] == "application/octet-stream"

    @pytest.mark.asyncio
    async def test_delete_calls_delete_object(self, backend, mock_s3_client):
        await backend.delete("photos/abc-123.png")

        mock_s3_client.delete_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="photos/abc-123.png",
        )

    @pytest.mark.asyncio
    async def test_delete_swallows_client_error(self, backend, mock_s3_client):
        """delete is best-effort — ClientError shouldn't propagate."""
        from botocore.exceptions import ClientError

        mock_s3_client.delete_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Not found"}},
            "DeleteObject",
        )
        # Should not raise
        await backend.delete("photos/nonexistent.png")

    @pytest.mark.asyncio
    async def test_public_url_trailing_slash_stripped(self):
        """Trailing slash on public_url shouldn't produce double-slash URLs."""
        from app.services.storage import S3StorageBackend

        b = S3StorageBackend(
            endpoint_url="https://fake.r2.cloudflarestorage.com",
            access_key_id="k",
            secret_access_key="s",
            bucket_name="b",
            public_url="https://pub-test.r2.dev/",
        )
        b.client = MagicMock()
        url = await b.upload(b"\x00", "photos/test.png")
        assert url == "https://pub-test.r2.dev/photos/test.png"


# ── get_storage_backend routing (Sprint 15) ──────────────────────


class TestGetStorageBackendRouting:
    """Verify the if/else in get_storage_backend picks the right class."""

    def test_returns_local_when_no_s3_config(self):
        """No S3_BUCKET_NAME → LocalStorageBackend."""
        from app.services.storage import LocalStorageBackend

        # Note: with patch only works with the lazy import you have (correct for existing)
        # with patch("app.services.storage.settings") as mock_settings:
        with patch("app.config.settings") as mock_settings:  # patch at the source
            mock_settings.s3_bucket_name = None
            mock_settings.photo_upload_dir = "/tmp/test-uploads"

            from app.services.storage import get_storage_backend
            backend = get_storage_backend()
            assert isinstance(backend, LocalStorageBackend)

    def test_returns_s3_when_bucket_configured(self):
        """S3_BUCKET_NAME set → S3StorageBackend."""
        from app.services.storage import S3StorageBackend

        # Note: with patch only works with the lazy import you have (correct for existing)
        # with patch("app.services.storage.settings") as mock_settings:
        with patch("app.config.settings") as mock_settings:  # patch at the source
            mock_settings.s3_bucket_name = "my-bucket"
            mock_settings.s3_endpoint_url = "https://fake.r2.cloudflarestorage.com"
            mock_settings.s3_access_key_id = "key"
            mock_settings.s3_secret_access_key = "secret"
            mock_settings.s3_public_url = "https://pub.r2.dev"

            from app.services.storage import get_storage_backend
            backend = get_storage_backend()
            assert isinstance(backend, S3StorageBackend)
