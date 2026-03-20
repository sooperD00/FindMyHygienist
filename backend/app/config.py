"""
Pydantic settings, reads .env (single source of truth)
(no defaults / silent fallbacks)
"""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(alias="DATABASE_PUBLIC_URL")
    secret_key: str
    admin_email: str
    auto_approve: bool

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
