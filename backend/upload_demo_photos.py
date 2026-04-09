# backend/upload_demo_photos.py
import sys
sys.path.insert(0, ".")

import asyncio
from pathlib import Path
from sqlalchemy import text
from app.database import engine
from app.services.storage import get_storage_backend

PHOTO_MAP = {
    "jenna.morris@example.com": "demo_photos/jenna.jpg",
    "ryan.ashworth@example.com": "demo_photos/ryan.jpg",
    "dana.henshaw@example.com": "demo_photos/dana.jpg",
    "elena.vega@example.com": "demo_photos/elena.jpg",
}

async def upload():
    storage = get_storage_backend()
    async with engine.begin() as conn:
        for email, photo_path in PHOTO_MAP.items():
            data = Path(photo_path).read_bytes()
            ext = Path(photo_path).suffix  # .jpg or .png

            # Get provider ID
            row = await conn.execute(text(
                "SELECT p.id FROM providers p JOIN users u ON p.user_id = u.id WHERE u.email = :email"
            ), {"email": email})
            provider_id = row.scalar()
            if not provider_id:
                print(f"  ⚠ No provider for {email}")
                continue

            key = f"photos/{provider_id}{ext}"
            url = await storage.upload(data, key)

            await conn.execute(text(
                "UPDATE providers SET photo_url = :url WHERE id = :id"
            ), {"url": url, "id": provider_id})
            print(f"  📸 {email} → {url}")

    print("Done.")

async def main():
    try:
        await upload()
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())