"""
Seed the Credential reference table from credentials.json.

Run from the backend/ directory after applying migrations:
    python -m app.seed

Safe to re-run — uses merge (upsert) so existing rows get updated
and new rows get inserted. Will not delete credentials that are in
the DB but not in the JSON file.
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, engine
from app.models.credential import Credential
from app.models.enums import CredentialType

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


async def main() -> None:
    try:
        await seed_credentials()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
