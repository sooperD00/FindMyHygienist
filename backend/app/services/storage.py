"""
Storage abstraction for file uploads (photos).

ABC defines the interface; LocalStorageBackend is the dev stub.
S3StorageBackend (Sprint 15) handles prod — boto3 against Cloudflare R2
or any S3-compatible endpoint. See ADR-005.

LocalStorageBackend uses synchronous file I/O (Path.write_bytes).
At FindMyHygienist's scale and file sizes (≤5MB photos), blocking the event loop
for a few ms is fine for a dev stub that gets replaced in production.
"""

from abc import ABC, abstractmethod
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, data: bytes, key: str) -> str:
        """Store file data under `key`, return the public URL."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete the file at `key`. No-op if it doesn't exist."""
        ...


class LocalStorageBackend(StorageBackend):
    """Write files to a local directory, serve via FastAPI StaticFiles.

    upload_dir: filesystem path (e.g. "./uploads")
    base_url:   URL prefix where StaticFiles is mounted (e.g. "/uploads")
    """

    def __init__(self, upload_dir: str, base_url: str) -> None:
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.base_url = base_url.rstrip("/")

    async def upload(self, data: bytes, key: str) -> str:
        path = (self.upload_dir / key).resolve()
        if not path.is_relative_to(self.upload_dir.resolve()):
            raise ValueError(f"Invalid key: {key}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.base_url}/{key}"

    async def delete(self, key: str) -> None:
        path = (self.upload_dir / key).resolve()
        if not path.is_relative_to(self.upload_dir.resolve()):
            raise ValueError(f"Invalid key: {key}")
        if path.exists():
            path.unlink()


# ── S3-compatible storage (Cloudflare R2 / DO Spaces) ────────────
# boto3's put_object / delete_object are synchronous but at ≤5MB
# per photo the blocking time is negligible for this app's scale.
# If that ever matters, swap to aioboto3.

# Content-type mapping — matches photo_service._EXT_MAP in reverse
from app.constants import CONTENT_TYPE_FROM_EXT

class S3StorageBackend(StorageBackend):
    """Upload/delete files on an S3-compatible bucket (R2, DO Spaces, AWS S3).

    public_url: the base URL where the bucket serves public reads,
                e.g. "https://pub-abc123.r2.dev" or a custom domain.
    """

    def __init__(
        self,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: str,
    ) -> None:
        self.bucket_name = bucket_name
        self.public_url = public_url.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    async def upload(self, data: bytes, key: str) -> str:
        """Sync calls inside async method, calls self.client.put_object(), 
        which is synchronous boto3. The sync call blocks the event loop thread 
        for the duration of the HTTP round-trip to R2. For a single user uploading 
        a 2MB headshot, that's maybe 200ms.

        TODO: if you need to do better: sync-in-async (now) → asyncio.to_thread (cheap fix) 
        → aioboto3 (real async).
        """
        ext = Path(key).suffix.lower()
        content_type = CONTENT_TYPE_FROM_EXT.get(ext, "application/octet-stream")

        self.client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return f"{self.public_url}/{key}"

    async def delete(self, key: str) -> None:
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=key,
            )
        except ClientError:
            # delete_object on S3 is idempotent (returns 204 even if
            # key doesn't exist), but R2/DO Spaces might differ on edge
            # cases. Swallow errors — delete is best-effort. Also catches auth failures, 
            # network errors, bucket-not-found. TODO: in a larger system, log the 
            # exception and maybe narrow the catch
            pass


def get_storage_backend() -> StorageBackend:
    """FastAPI dependency — returns the active storage backend.
    "The Strategy Pattern" single decision point where files go;
    rest of the app is storage-agnostic. Zero changes to upload/delete endpoints.

    If S3 config is present, use S3StorageBackend (prod).
    Otherwise fall back to LocalStorageBackend (dev).
    """
    from app.config import settings  # lazy import to avoid circular import

    # TODO: get_storage_backend() creates a new client per call. Every time 
    # FastAPI resolves this dependency, it instantiates a fresh boto3.client — 
    # which involves an HTTP-level setup cost. Not a problem at demo scale.
    # Later, implement production pattern: create the client once at startup 
    # (e.g., in a FastAPI lifespan event) and reuse it.

    if settings.s3_bucket_name:
        return S3StorageBackend(
            endpoint_url=settings.s3_endpoint_url,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            bucket_name=settings.s3_bucket_name,
            public_url=settings.s3_public_url,
        )

    return LocalStorageBackend(
        upload_dir=settings.photo_upload_dir,
        base_url="/uploads",
    )
