"""
Photo upload/delete operations.

Validation functions are pure (no DB, no I/O) — easy to unit test.
upload_photo and delete_photo orchestrate: validate → store → update DB.
The caller (route layer) handles commits.

Naming convention: photos/{provider_id}.{ext} — one photo per provider,
new upload overwrites. No orphan cleanup needed.
"""

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider import Provider
from app.services.storage import StorageBackend


ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB

# content-type → file extension
_EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# fast and early exit on MIME string
def validate_content_type(content_type: str) -> None:
    """Raise ValueError if the MIME type isn't an accepted image format."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported image type: {content_type}. "
            "Accepted: JPEG, PNG, WebP"
        )


def validate_file_size(size: int) -> None:
    """Raise ValueError if the file exceeds the 5 MB limit."""
    if size > MAX_PHOTO_SIZE:
        raise ValueError(
            f"File too large: {size:,} bytes. "
            f"Maximum: {MAX_PHOTO_SIZE:,} bytes (5 MB)"
        )

# real file type validation on the file itself (Clients can lie in the MIME string)
def detect_image_type(data: bytes) -> str:
    """Return the MIME type based on magic bytes, or raise."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise ValueError("Not an accepted image format")

def photo_key(provider_id: str, content_type: str) -> str:
    """Build the storage key for a provider's photo.

    Example: photo_key("abc-123", "image/png") → "photos/abc-123.png"
    """
    ext = _EXT_MAP[content_type]
    return f"photos/{provider_id}.{ext}"


def _key_from_url(url: str) -> str | None:
    """Extract the storage key from a photo URL.

    Works for both local (/uploads/photos/id.jpg) and future S3
    (https://bucket.../photos/id.jpg) URLs — looks for the "photos/"
    marker and takes everything from there.

    Returns None if the URL doesn't match the expected pattern
    (e.g., manually set photo_url from seed data).
    """
    marker = "photos/"
    idx = url.find(marker)
    if idx == -1:
        return None
    return url[idx:]


async def upload_photo(
    db: AsyncSession,
    provider: Provider,
    file: UploadFile,
    storage: StorageBackend,
) -> str:
    """Validate, store, and link a profile photo.

    Deletes the old photo first if one exists (the new upload might
    have a different extension, so we can't just overwrite by key).
    Returns the new photo URL.
    """
    content_type = file.content_type or ""
    validate_content_type(content_type)  # fast and early exit on MIME string

    data = await file.read()
    validate_file_size(len(data))
    content_type = detect_image_type(data)  # magic bytes are the truth

    # Delete old photo if it exists (different extension = different key)
    if provider.photo_url:
        old_key = _key_from_url(provider.photo_url)
        if old_key:
            await storage.delete(old_key)

    key = photo_key(str(provider.id), content_type)
    url = await storage.upload(data, key)

    provider.photo_url = url
    db.add(provider)
    await db.flush()

    return url


async def delete_photo(
    db: AsyncSession,
    provider: Provider,
    storage: StorageBackend,
) -> None:
    """Remove a provider's profile photo from storage and DB.

    No-op if the provider has no photo (idempotent delete).
    """
    if not provider.photo_url:
        return

    old_key = _key_from_url(provider.photo_url)
    if old_key:
        await storage.delete(old_key)

    provider.photo_url = None
    db.add(provider)
    await db.flush()
