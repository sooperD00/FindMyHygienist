"""
Re-export all models so the rest of the app can do:
    from app.models import Provider, User, Credential, ...

This also ensures all models are imported before Alembic reads
SQLModel.metadata — if a model isn't imported here, Alembic won't
see its table.
"""

from app.models.enums import (  # noqa: F401
    Availability,
    CredentialType,
    FeedbackType,
    ProviderStatus,
    ProviderType,
    UserRole,
)
from app.models.user import User  # noqa: F401
from app.models.credential import Credential  # noqa: F401
from app.models.provider import (  # noqa: F401
    Provider,
    ProviderCredential,
    ProviderLocation,
)
from app.models.feedback import Feedback  # noqa: F401
