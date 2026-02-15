import httpx
import msal
import os
import secrets
from api.config import FRONTEND_URL, ENABLE_HTTPS
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime, timedelta, timezone

SESSION_COOKIE_NAME = "weiss_session"
SESSION_EXPIRE_HOURS = 24

# Microsoft Auth / MSAL Config
MS_AUTH_TENANT_ID = os.getenv("MS_AUTH_TENANT_ID", "common")
MS_AUTH_CLIENT_ID = os.getenv("MS_AUTH_CLIENT_ID")
MS_AUTH_CLIENT_SECRET = os.getenv("MS_AUTH_CLIENT_SECRET")

MS_AUTHORITY = f"https://login.microsoftonline.com/{MS_AUTH_TENANT_ID}"
MS_SCOPES = ["email", "User.Read"]
MS_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)


# Models
class UserRole(str, Enum):
    DEVELOPER = "developer"
    OPERATOR = "operator"


class AuthProvider(str, Enum):
    MICROSOFT = "microsoft"
    DEMO = "demo"


class User(BaseModel):
    id: str
    username: str
    email: Optional[str]
    provider: AuthProvider
    provider_id: str
    role: UserRole = UserRole.OPERATOR
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OAuthCallbackRequest(BaseModel):
    provider: AuthProvider
    code: Optional[str] = None
    redirect_uri: Optional[str] = None


class Session(BaseModel):
    id: str
    user_id: str
    expires_at: datetime


class AuthURL(BaseModel):
    authorize_url: str


# In-memory storage (temporary, replace with DB soon)
users_db: dict[str, User] = {}
sessions: dict[str, Session] = {}


def ensure_microsoft_configured():
    if not MS_AUTH_CLIENT_ID or not MS_AUTH_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Microsoft authentication is not configured on this server",
        )


def get_msal_app() -> msal.ConfidentialClientApplication:
    ensure_microsoft_configured()
    return msal.ConfidentialClientApplication(
        client_id=MS_AUTH_CLIENT_ID,
        client_credential=MS_AUTH_CLIENT_SECRET,
        authority=MS_AUTHORITY,
    )


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

    return user


# Provider helpers
async def get_ms_user(access_token: str) -> dict:
    ensure_microsoft_configured()
    async with httpx.AsyncClient() as client:
        res = await client.get(
            MS_GRAPH_ME_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        res.raise_for_status()
        return res.json()


async def handle_microsoft_callback(code: str, redirect_uri: str) -> User:
    ensure_microsoft_configured()
    msal_app = get_msal_app()
    result = msal_app.acquire_token_by_authorization_code(
        code,
        scopes=MS_SCOPES,
        redirect_uri=redirect_uri,
    )

    if "access_token" not in result:
        raise HTTPException(
            status_code=400,
            detail=f"MSAL token acquisition failed: {result.get('error_description')}",
        )

    ms_user = await get_ms_user(result["access_token"])

    provider_id = ms_user["id"]
    user_id = f"ms_{provider_id}"

    if user_id not in users_db:
        users_db[user_id] = User(
            id=user_id,
            username=ms_user.get("displayName") or ms_user.get("userPrincipalName"),
            email=ms_user.get("mail") or ms_user.get("userPrincipalName"),
            provider=AuthProvider.MICROSOFT,
            provider_id=provider_id,
            role=UserRole.OPERATOR,  # Default role, to be fetched from DB later
        )

    return users_db[user_id]


async def handle_demo_login(role: UserRole) -> User:
    user_id = f"demo_user_{role.value}"

    if user_id not in users_db:
        users_db[user_id] = User(
            id=user_id,
            username=f"Demo {role.value.capitalize()}",
            email=None,
            provider=AuthProvider.DEMO,
            provider_id=AuthProvider.DEMO.value,
            role=role,
        )

    return users_db[user_id]


################
# Routes
################
@router.get("/{provider}/authorize", operation_id="authGetAuthURL", response_model=AuthURL)
async def authorize(provider: AuthProvider, demo_profile: UserRole | None = None):
    if provider == AuthProvider.MICROSOFT:
        ensure_microsoft_configured()
        redirect_uri = f"{FRONTEND_URL}/auth/callback"

        auth_url = get_msal_app().get_authorization_request_url(
            scopes=MS_SCOPES,
            redirect_uri=redirect_uri,
            state="microsoft",
            response_mode="query",
        )
        return {"authorize_url": auth_url}

    if provider == AuthProvider.DEMO:
        if demo_profile not in [role.value for role in UserRole]:
            raise HTTPException(status_code=400, detail="Invalid or missing demo profile")

        dummy_code = f"demo_code_{demo_profile.value}"
        redirect_url = f"{FRONTEND_URL}/auth/callback?code={dummy_code}&state=demo"
        return {"authorize_url": redirect_url}

    raise HTTPException(status_code=400, detail="Unsupported provider")


@router.post(
    "/callback",
    response_model=User,
    operation_id="authCallback",
)
async def oauth_callback(
    payload: OAuthCallbackRequest,
    response: Response,
):
    if not payload.code or not payload.redirect_uri:
        raise HTTPException(status_code=400, detail="Missing OAuth parameters")

    if payload.provider == AuthProvider.MICROSOFT:
        user = await handle_microsoft_callback(
            payload.code,
            payload.redirect_uri,
        )

    elif payload.provider == AuthProvider.DEMO:
        demo_role = payload.code.split("_")[-1]
        if demo_role not in [r.value for r in UserRole]:
            raise HTTPException(status_code=400, detail="Invalid demo profile")
        user = await handle_demo_login(UserRole(demo_role))

    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    session = create_session(user.id)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.id,
        httponly=True,
        secure=ENABLE_HTTPS,
        samesite="none" if ENABLE_HTTPS else None,
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
