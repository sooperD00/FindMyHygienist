"""
User — auth identity for everyone.

Nicole's admin account is a User with role=ADMIN and no Provider record.
A dental hygienist is a User with role=PROVIDER linked one-to-one to a
Provider record. See ADR-009.

password max length 255 chars for argon2id = industry standard (memory and cpu hard)
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, SQLModel

from app.models.enums import UserRole


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=254)
    # bcrypt output is always 60 chars, argon2id is 97, industry standard is 255
    # changed plan to use argon2id, recommended by OWASP since 2019, memory hard against GPU attacks as well as CPU
    password_hash: str = Field(max_length=255)  
    role: UserRole
    is_active: bool = Field(default=True)

    # DB-level timestamps — server_default so they work even if Python
    # code forgets to set them. onupdate for updated_at is a convenience;
    # application code should also set it explicitly on writes.
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), nullable=False
        ),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
