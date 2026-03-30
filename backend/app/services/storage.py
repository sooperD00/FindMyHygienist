"""
Storage abstraction for file uploads (photos).

ABC defines the interface; LocalStorageBackend is the dev stub.
Sprint 12 adds S3StorageBackend (boto3) — same interface, swap one
dependency, zero caller changes. See ADR-005.

LocalStorageBackend uses synchronous file I/O (Path.write_bytes).
At OHP's scale and file sizes (≤5MB photos), blocking the event loop
for a few ms is fine for a dev stub that gets replaced in production.
"""

from abc import ABC, abstractmethod
from pathlib import Path


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


def get_storage_backend() -> StorageBackend:
    """FastAPI dependency — returns the active storage backend.

    Currently always LocalStorageBackend. Sprint 12 replaces this
    with S3StorageBackend based on an env var or config flag.
    """
    from app.config import settings  # lazy import to avoid circular import, common in FastAPI Dependency() functions

    return LocalStorageBackend(
        upload_dir=settings.photo_upload_dir,
        base_url="/uploads",
    )
