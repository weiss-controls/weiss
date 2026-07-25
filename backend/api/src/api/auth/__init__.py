import importlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from ..config import ENABLE_HTTPS
from ..models.user import AuthProvider, AuthURL, OAuthCallbackRequest, Session, User, UserRole
from . import roles_config
from .providers.generic import GenericProvider

SESSION_COOKIE_NAME = "weiss_session"
DEMO_ID_COOKIE = "weiss_demo_id"  # allow differ demo sessions
SESSION_EXPIRE_HOURS = 24

ISSUER = os.getenv("AUTH_ISSUER", "http://127.0.0.1:8089/realms/master")

auth_type = os.getenv("IDENTITY_PROVIDER", "oauth")
try:
    _current_auth = importlib.import_module("api.auth.providers." + auth_type)

    _Provider = _current_auth.Provider
    assert issubclass(_Provider, GenericProvider)
except (AssertionError, ImportError):
    raise ValueError("Unsupported provider provided")

Provider: GenericProvider = _Provider

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

# In-memory storage (temporary, replace with DB soon)
users_db: dict[str, User] = {}
sessions: dict[str, Session] = {}


def create_session(user_id: str) -> Session:
    session_id = secrets.token_urlsafe(32)
    session = Session(
        id=session_id,
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRE_HOURS),
    )
    sessions[session_id] = session
    return session


def delete_session(session_id: str):
    sessions.pop(session_id, None)


def prune_expired_sessions() -> None:
    """Remove all expired sessions (and orphaned users) from in-memory stores."""
    now = datetime.now(timezone.utc)
    expired_ids = [sid for sid, s in sessions.items() if s.expires_at < now]
    for sid in expired_ids:
        sessions.pop(sid, None)
    # Remove users that have no remaining valid session
    active_user_ids = {s.user_id for s in sessions.values()}
    orphaned = [uid for uid in users_db if uid not in active_user_ids]
    for uid in orphaned:
        users_db.pop(uid, None)


def get_session(session_id: str) -> Session | None:
    session = sessions.get(session_id)
    if not session:
        return None
    if session.expires_at < datetime.now(timezone.utc):
        delete_session(session_id)
        return None
    return session


async def get_current_user(request: Request) -> User:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    user = users_db.get(session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Re-resolve role on every request so config-file changes take effect
    # without requiring users to log out and back in.
    if user.provider != AuthProvider.DEMO:
        user.role = UserRole.DEVELOPER if roles_config.is_developer(user.username) else UserRole.OPERATOR

    return user


@router.get("/{provider}/authorize", operation_id="authGetAuthURL", response_model=AuthURL)
async def authorize(provider: AuthProvider, demo_profile: UserRole | None = None):
    return await Provider.create_authorization_url(demo_profile)


@router.post(
    "/callback",
    response_model=User,
    operation_id="authCallback",
)
async def oauth_callback(
    payload: OAuthCallbackRequest,
    request: Request,
    response: Response,
):
    if not payload.code or not payload.redirect_uri:
        raise HTTPException(status_code=400, detail="Missing OAuth parameters")

    user: User = await Provider.handle_auth_callback(code=payload.code, redirect_uri=payload.redirect_uri)

    if user.id not in users_db:
        role = UserRole.DEVELOPER if user.username and roles_config.is_developer(user.username) else UserRole.OPERATOR
        users_db[user.id] = User(
            **user.model_dump(exclude_unset=True),
            role=role,
        )

    session = create_session(user.id)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.id,
        httponly=True,
        secure=ENABLE_HTTPS,
        samesite="none" if ENABLE_HTTPS else "lax",
        max_age=SESSION_EXPIRE_HOURS * 3600,
        path="/",
    )

    return user


@router.get(
    "/me",
    response_model=User,
    operation_id="authMe",
)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post(
    "/logout",
    operation_id="authLogout",
)
async def logout(request: Request, response: Response):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        delete_session(session_id)

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )

    return {"message": "Logged out"}


class ReloadRolesResponse(BaseModel):
    reloaded: bool
    developer_count: int


@router.post(
    "/admin/reload-roles",
    response_model=ReloadRolesResponse,
    operation_id="authReloadRoles",
)
async def reload_roles(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DEVELOPER:
        raise HTTPException(status_code=403, detail="Developer role required")
    count = roles_config.reload_roles()
    return {"reloaded": True, "developer_count": count}
