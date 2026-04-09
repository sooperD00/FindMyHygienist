# backend/delete_demo.py
import sys
sys.path.insert(0, ".")

import asyncio
from sqlalchemy import text
from app.database import engine

DEMO_EMAILS = [
    "jenna.morris@example.com",
    "ryan.ashworth@example.com",
    "dana.henshaw@example.com",
    "elena.vega@example.com",
    "f_loss_provider@example.com",
]

async def delete():
    async with engine.begin() as conn:
        # Find user IDs
        rows = await conn.execute(text(
            "SELECT id FROM users WHERE email = ANY(:emails)"
        ), {"emails": DEMO_EMAILS})
        user_ids = [r[0] for r in rows.fetchall()]

        if not user_ids:
            print("No demo users found.")
            return

        # Find provider IDs
        rows = await conn.execute(text(
            "SELECT id FROM providers WHERE user_id = ANY(:ids)"
        ), {"ids": user_ids})
        provider_ids = [r[0] for r in rows.fetchall()]

        # Delete leaf → root
        if provider_ids:
            await conn.execute(text(
                "DELETE FROM provider_credentials WHERE provider_id = ANY(:ids)"
            ), {"ids": provider_ids})
            await conn.execute(text(
                "DELETE FROM provider_locations WHERE provider_id = ANY(:ids)"
            ), {"ids": provider_ids})
            await conn.execute(text(
                "DELETE FROM providers WHERE id = ANY(:ids)"
            ), {"ids": provider_ids})
        
        await conn.execute(text(
            "DELETE FROM sessions WHERE user_id = ANY(:ids)"
        ), {"ids": user_ids})

        await conn.execute(text(
            "DELETE FROM users WHERE id = ANY(:ids)"
        ), {"ids": user_ids})

        print(f"Deleted {len(user_ids)} users, {len(provider_ids)} providers, and their children")

async def main():
    try:
        await delete()
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())