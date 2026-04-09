# backend/check_demo.py
import sys
sys.path.insert(0, ".")

from app.database import engine
import asyncio
from sqlalchemy import text

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT u.email, p.photo_url FROM providers p JOIN users u ON p.user_id = u.id WHERE u.email LIKE '%@example.com'"
        ))
        rows = result.fetchall()
        print(f"{len(rows)} rows found")
        for r in rows:
            print(r)

asyncio.run(check())