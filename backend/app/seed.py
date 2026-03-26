"""
Seed the database with reference data and the admin account.

Run from the backend/ directory after applying migrations:
    python -m app.seed

Two operations:
  1. Credential reference table — upsert from credentials.json (Sprint 1)
  2. Admin user — create Nicole's ADMIN account if it doesn't exist (Sprint 2)

Safe to re-run. Credentials use merge (upsert). Admin skips if exists.
"""

import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session, engine
from app.models.credential import Credential
from app.models.enums import CredentialType, UserRole
from app.models.user import User

DATA_FILE = Path(__file__).parent / "data" / "credentials.json"


async def seed_credentials() -> None:
    raw = json.loads(DATA_FILE.read_text())
    print(f"Read {len(raw)} credentials from {DATA_FILE.name}")

    async with async_session() as session:  # type: AsyncSession
        for entry in raw:
            credential = Credential(
                code=entry["code"],
                full_name=entry["full_name"],
                patient_description=entry["patient_description"],
                credential_type=CredentialType(entry["credential_type"]),
            )
            await session.merge(credential)

        await session.commit()
        print(f"Seeded {len(raw)} credentials into the database.")


async def seed_admin() -> None:
    """Create Nicole's admin User if it doesn't exist.

    Reads ADMIN_EMAIL from settings (required) and ADMIN_PASSWORD from
    .env (optional — skip if not set). This separation means the app
    starts fine without ADMIN_PASSWORD; you only need it when seeding.
    """
    # Import here to avoid circular dependency (auth_service → models → enums)
    from app.services.auth_service import hash_password, get_user_by_email

    if not settings.admin_password:
        print("ADMIN_PASSWORD not set in .env — skipping admin seed.")
        print("  Set ADMIN_PASSWORD and re-run to create the admin account.")
        return

    async with async_session() as session:
        existing = await get_user_by_email(session, settings.admin_email)
        if existing:
            print(f"Admin user {settings.admin_email} already exists — skipping.")
            return

        admin = User(
            id=uuid.uuid4(),
            email=settings.admin_email.lower(),
            password_hash=hash_password(settings.admin_password),
            role=UserRole.ADMIN,
        )
        session.add(admin)
        await session.commit()
        print(f"Created admin user: {settings.admin_email}")


async def main() -> None:
    try:
        await seed_credentials()
        await seed_admin()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
