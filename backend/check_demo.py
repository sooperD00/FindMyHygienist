# backend/check_demo.py
import sys
sys.path.insert(0, ".")

from app.database import engine
import asyncio
from sqlalchemy import text

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT email FROM users WHERE email LIKE '%@example.com'"
        ))
        rows = result.fetchall()
        print(f"{len(rows)} rows found")
        for r in rows:
            print(r)

asyncio.run(check())