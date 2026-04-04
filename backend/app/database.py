"""
SQLModel, Async engine + session setup
"""

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

db_url = settings.database_url
if "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# echo (log) every SQL statement in dev/debug=True, but not in production
engine = create_async_engine(db_url, echo=settings.debug)

async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables. Replace with Alembic migrations when ready."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session():
    """Dependency: yields an async database session per request."""
    async with async_session() as session:
        yield session
