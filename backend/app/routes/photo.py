"""
Photo upload and delete endpoints.

POST /api/me/photo  — upload profile photo (multipart/form-data)
DELETE /api/me/photo — remove profile photo

Both require auth + CSRF (state-changing).

The storage backend is injected via Depends(get_storage_backend) —
LocalStorageBackend in dev, S3StorageBackend in prod (Sprint 12).
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_provider_csrf
from app.models.provider import Provider
from app.services import photo_service
from app.services.storage import StorageBackend, get_storage_backend

router = APIRouter(tags=["photo"])


# ── Response schema ──────────────────────────────────────────────


class PhotoResponse(BaseModel):
    """Returned after upload or delete — just the URL (or null)."""

    photo_url: str | None


# ── Endpoints ────────────────────────────────────────────────────
# UploadFile as a parameter with no File(...) annotation works because 
# FastAPI special-cases UploadFile — it automatically reads it from multipart 
# form data. If you ever need to add metadata alongside the file (like a caption), 
# you'd need Form(...) parameters too, and multipart + JSON body in the same request gets quirky
@router.post("/api/me/photo", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile,
    provider: Provider = Depends(get_current_provider_csrf),
    db: AsyncSession = Depends(get_session),
    storage: StorageBackend = Depends(get_storage_backend),
):
    """Upload a profile photo. Replaces existing photo if present.

    Accepts JPEG, PNG, or WebP. Max 5 MB. Sent as multipart/form-data
    with the file in a field named "file".
    """
    try:
        url = await photo_service.upload_photo(db, provider, file, storage)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    return PhotoResponse(photo_url=url)


@router.delete("/api/me/photo", response_model=PhotoResponse)
async def delete_photo(
    provider: Provider = Depends(get_current_provider_csrf),
    db: AsyncSession = Depends(get_session),
    storage: StorageBackend = Depends(get_storage_backend),
):
    """Remove the provider's profile photo.

    Idempotent — returns photo_url=null whether or not a photo existed.
    """
    await photo_service.delete_photo(db, provider, storage)
    await db.commit()
    return PhotoResponse(photo_url=None)
