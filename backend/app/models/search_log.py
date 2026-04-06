"""
SearchLog — anonymous search analytics.

Records every patient-facing search for product analytics and the
ADR-016 batch tag suggestion pipeline. No PII — query_text is the
raw location input (zip/address), not patient identity. filters_applied
and result_provider_ids are JSONB for flexible querying.

Fire-and-forget: the search endpoint logs asynchronously and never
blocks the response on a failed insert.
"""

import uuid
from datetime import datetime  # here for type annotation only, db handles now() with func.now()

from sqlalchemy import Column, DateTime, JSON, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class SearchLog(SQLModel, table=True):
    __tablename__ = "search_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # save the raw plain-string
    query_text: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    
    # - classic Python mutable default argument footgun:
    #  dict/list | None = Field(default=None (not {} or []))
    # - JSONB so you don't have to parse every row to answer queries
    # PostgreSQL-specific type, great for this application
    filters_applied: dict | None = Field(default=None, sa_column=Column(JSONB))
    result_provider_ids: list | None = Field(default=None, sa_column=Column(JSONB))
    
    # dedicated col for result_count - cheap to store rather than compute on the fly
    # makes a lot of future queries one-liners
    result_count: int = Field(default=0)
    
    # database-side timestamp = authoritative and doesn't drift with app server clocks
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True), 
            server_default=func.now(), # db func.now (not python utc.now())
            nullable=False
        ),
    )
