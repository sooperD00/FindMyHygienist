"""
Feedback — issue reports and general feedback from patients/visitors.

Two entry points: "Report an issue" (tied to a specific provider) and
"Give us feedback" (general, no provider_id).
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.models.enums import FeedbackType


class Feedback(SQLModel, table=True):
    __tablename__ = "feedback"
    __table_args__ = (
        CheckConstraint("length(message) <= 10000", name="ck_feedback_message_length"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    type: FeedbackType

    # This feedback was submitted by this user
    # Anonymous visitor → submitted_by_user_id=None, is_authenticated=False
    # Logged-in provider → submitted_by_user_id=<their id>, is_authenticated=True
    # No one is ever forced to log in
    is_authenticated: bool = Field(default=False)
    submitted_by_user_id: uuid.UUID | None = Field( 
        default=None, foreign_key="users.id"
    )

    # this feedback is *about* this provider
    provider_id: uuid.UUID | None = Field(
        default=None, foreign_key="providers.id"
    )

    # Optional; Typed in the feedback form - not grabbed from database for logged in users
    reporter_email: str | None = Field(default=None, max_length=254)
    message: str = Field(sa_column=Column(Text, nullable=False))
    
    # created_at uses the Pydantic/SQLAlchemy workaround:
    # The Python type hint is lying a little to make the two systems coexist
    #   datetime | None + default=None  → lets Pydantic create the object without a value
    #   server_default=func.now()       → Postgres fills it in at INSERT time
    #   nullable=False                  → the column is never actually NULL in the DB
    # The None only exists in the
    created_at: datetime | None = Field(
        default=None,  # Pydantic, let me create this object without a value. I know it looks like None right now. The database will fill it in.
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), 
            nullable=False  # Postgres, never actually store NULL here — the server_default guarantees a value.
        ),
    )
    resolved: bool = Field(default=False)
