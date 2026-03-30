"""
Provider — the public-facing directory profile.

ProviderCredential — many-to-many join between Provider and Credential
    both sides can have multiple of each other
    SQL doesn't have a native way to express this - a foreign key is always one-to-many
    so you introdocue a third table whose only job is holding pairs of foreign keys
    = a "join table", "juction table", "bridge table", "association table"
    and a composite primary key prevents duplicates
    no columns of its own beyond the two FKs - it exists purely to hold the relationship

ProviderLocation — one-to-many, multiple practice locations per provider.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Text, JSON, func
from sqlmodel import Field, SQLModel

from app.models.enums import Availability, ProviderStatus, ProviderType


class Provider(SQLModel, table=True):
    __tablename__ = "providers"
    __table_args__ = (
        # Postgres check constraint for max char limits on TEXT types
        CheckConstraint("length(bio) <= 10000", name="ck_provider_bio_length"),
        CheckConstraint("length(mission_statement) <= 5000", name="ck_provider_mission_length"),
        CheckConstraint("length(draft::text) <= 50000", name="ck_provider_draft_length"),
        CheckConstraint("length(languages::text) <= 5000", name="ck_provider_languages_length"),
        CheckConstraint("length(services::text) <= 5000", name="ck_provider_services_length"),
        CheckConstraint("length(specialties::text) <= 5000", name="ck_provider_specialties_length"),
        CheckConstraint("length(populations_served::text) <= 5000", name="ck_provider_populations_length"),
        CheckConstraint("length(insurance_accepted::text) <= 5000", name="ck_provider_insurance_length"),
        CheckConstraint("length(tags::text) <= 5000", name="ck_provider_tags_length"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", unique=True, index=True)

    # --- Display identity ---
    display_name: str = Field(max_length=200)
    slug: str = Field(unique=True, index=True, max_length=200)
    provider_type: ProviderType
    title_line: str | None = Field(default=None, max_length=300)  # freeform, e.g. "RDH, BSDH"

    # --- Long-form content ---
    bio: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    mission_statement: str | None = Field(default=None, sa_column=Column(Text, nullable=True))

    # --- Photo ---
    photo_url: str | None = Field(default=None, max_length=1000)

    # --- Public contact info (separate from login email on User) ---
    phone: str | None = Field(default=None, max_length=30)
    public_email: str | None = Field(default=None, max_length=254)
    website: str | None = Field(default=None, max_length=500)

    # --- Structured arrays for search filters ---
    # (sa_column=Column(JSON) because SQLModel doesn't natively map
    # list[str] to a Postgres JSON column. sa_column = SQLAlchemy column (drop down 1 layer of abstraction))
    languages: list[str] | None = Field(default=None, sa_column=Column(JSON))
    services: list[str] | None = Field(default=None, sa_column=Column(JSON))
    specialties: list[str] | None = Field(default=None, sa_column=Column(JSON))
    populations_served: list[str] | None = Field(
        default=None, sa_column=Column(JSON)
    )
    insurance_accepted: list[str] | None = Field(
        default=None, sa_column=Column(JSON)
    )

    # --- Freeform tags for self-expression beyond structured fields ---
    # e.g. ["LGBTQ-affirming", "anxiety-friendly", "trauma-informed"]
    tags: list[str] | None = Field(default=None, sa_column=Column(JSON))

    # --- Availability & contact preferences ---
    availability: Availability | None = Field(default=None)
    accepting_new_patients: bool = Field(default=True)
    max_travel_miles: int | None = Field(default=None)
    accepts_texts: bool = Field(default=False)
    accepts_calls: bool = Field(default=True)

    # --- Approval workflow ---
    status: ProviderStatus = Field(default=ProviderStatus.PENDING)
    auto_approved: bool = Field(default=False)
    reviewed_by: uuid.UUID | None = Field(
        default=None, foreign_key="users.id"
    )
    reviewed_at: datetime | None = Field(default=None)

    # --- Draft edits (ADR-003) ---
    # Unstructured JSON — holds partial copy of whatever fields the
    # provider edited. Null means "no pending edits."
    draft: dict | None = Field(default=None, sa_column=Column(JSON))

    # --- Timestamps ---
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


class ProviderCredential(SQLModel, table=True):
    """Many-to-many join between Provider and Credential.

    Providers select from valid Oregon credential codes; the frontend
    renders them as tappable chips using Credential.patient_description.
    """

    __tablename__ = "provider_credentials"

    provider_id: uuid.UUID = Field(
        foreign_key="providers.id", primary_key=True
    )
    credential_code: str = Field(
        foreign_key="credentials.code", primary_key=True
    )


class ProviderLocation(SQLModel, table=True):
    """A single practice location for a provider.

    Separate table because a provider might serve multiple locations
    (their own office + a community health clinic + a school-based
    program). Label tells patients *what kind* of place it is.
    Practice name is per-location because a hygienist might work at
    "Pacific Dental Services" on Tuesdays and "Salem Community Health
    Center" on Thursdays.
    """

    __tablename__ = "provider_locations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    provider_id: uuid.UUID = Field(foreign_key="providers.id", index=True)

    label: str = Field(max_length=100)  # e.g. "Main Office", "Mobile Area", "School-Based Program"
    practice_name: str | None = Field(default=None, max_length=200)
    address_line1: str | None = Field(default=None, max_length=300)
    address_line2: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, index=True, max_length=100)  # nullable for zip-only private locations (ADR-013)
    state: str = Field(default="OR", max_length=2)  # don't hardcode — ADR-008
    zip_code: str | None = Field(default=None, index=True, max_length=10)
    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)
    is_primary: bool = Field(default=False)
    is_public: bool = Field(default=True)  # ADR-013: False = search-only, invisible on public profile
