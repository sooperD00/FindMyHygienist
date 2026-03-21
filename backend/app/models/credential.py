"""
Credential — Oregon oral health credential reference table.

Seeded from app/data/credentials.json (not user-editable at runtime).
The patient_description powers the "tappable credential chips" feature
from Focus Group #1. See ADR-010.
"""

from sqlmodel import Field, SQLModel

from app.models.enums import CredentialType


class Credential(SQLModel, table=True):
    __tablename__ = "credentials"

    code: str = Field(primary_key=True, max_length=10)  # e.g. "RDH", "EPDH"
    full_name: str = Field(max_length=100)  # "Expanded Practice Dental Hygienist" is 38 chars
    patient_description: str = Field(max_length=500)  # plain-English, shown to patients on tap/hover (longest current entry is ~100 chars, but leave room for richer descriptions)
    credential_type: CredentialType
