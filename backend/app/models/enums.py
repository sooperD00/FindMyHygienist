"""
Enum definitions for the OHP data model.

These are plain Python enums used as column types via SQLAlchemy's
Enum() type. SQLModel handles the mapping — the DB column stores the
string value (e.g. 'PROVIDER', 'APPROVED').
"""

import enum


class UserRole(str, enum.Enum):
    PROVIDER = "PROVIDER"
    ADMIN = "ADMIN"


class CredentialType(str, enum.Enum):
    LICENSE = "LICENSE"
    DEGREE = "DEGREE"
    PERMIT = "PERMIT"
    SPECIALTY = "SPECIALTY"


class ProviderType(str, enum.Enum):
    DENTAL_HYGIENIST = "DENTAL_HYGIENIST"
    DENTIST = "DENTIST"
    DENTAL_THERAPIST = "DENTAL_THERAPIST"
    DENTAL_ASSISTANT = "DENTAL_ASSISTANT"
    OTHER = "OTHER"


class ProviderStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    SUSPENDED = "SUSPENDED"


class Availability(str, enum.Enum):
    IN_PERSON = "IN_PERSON"
    MOBILE = "MOBILE"
    BOTH = "BOTH"


class FeedbackType(str, enum.Enum):
    REPORT_ISSUE = "REPORT_ISSUE"
    GENERAL_FEEDBACK = "GENERAL_FEEDBACK"
