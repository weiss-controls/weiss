# Models
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class Session(BaseModel):
    id: str
    user_id: str
    expires_at: datetime


class AuthProvider(str, Enum):
    MICROSOFT = "microsoft"
    DEMO = "demo"
    OAUTH = "oauth"


class AuthURL(BaseModel):
    authorize_url: str


class UserRole(str, Enum):
    DEVELOPER = "developer"
    OPERATOR = "operator"


class User(BaseModel):
    id: str
    username: str
    displayName: str
    email: str | None
    provider: AuthProvider
    provider_id: str
    role: UserRole = UserRole.OPERATOR
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OAuthCallbackRequest(BaseModel):
    provider: AuthProvider
    code: str | None = None
    redirect_uri: str | None = None
    state: str | None = None
