# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Guilherme de Freitas

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import HTTPException

from ...config import FRONTEND_URL
from ...models.user import AuthProvider, User
from .generic import GenericProvider

_pending_states: dict[str, datetime] = {}
_STATE_TTL_MINUTES = 10


class Provider(GenericProvider):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    jwks_uri: str
    client: AsyncOAuth2Client

    client_id: str
    client_secret: str
    issuer: str

    @staticmethod
    async def set(client_id: str, client_secret: str, issuer: str):
        Provider.issuer = issuer

        async with httpx.AsyncClient() as client:
            res = await client.get(issuer + "/.well-known/openid-configuration")

            if res.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"OIDC discovery failed: {res.status_code}",
                )

            endpoints = res.json()

            Provider.authorization_endpoint = endpoints["authorization_endpoint"]
            Provider.token_endpoint = endpoints["token_endpoint"]
            Provider.userinfo_endpoint = endpoints["userinfo_endpoint"]
            Provider.jwks_uri = endpoints["jwks_uri"]

        redirect_uri = f"{FRONTEND_URL}/auth/callback"
        Provider.client = AsyncOAuth2Client(
            client_id=client_id,
            client_secret=client_secret,
            scope=["email", "profile", "openid"],
            redirect_uri=redirect_uri,
        )

    @staticmethod
    def _create_authorization_url(state: Any | None = None):
        return Provider.client.create_authorization_url(Provider.authorization_endpoint, state=state)

    @staticmethod
    async def _get_user(access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                Provider.userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            res.raise_for_status()
            return res.json()

    async def create_authorization_url(demo_profile: str | None = None):
        state = f"oauth:{secrets.token_urlsafe(16)}"
        _pending_states[state] = datetime.now(timezone.utc) + timedelta(minutes=_STATE_TTL_MINUTES)
        auth_url = Provider._create_authorization_url(state=state)
        return {"authorize_url": auth_url[0]}

    async def handle_auth_callback(code: str, redirect_uri: str, state: str | None = None):
        expiry = _pending_states.pop(state, None) if state else None
        if expiry is None or expiry < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

        result = await Provider.client.fetch_token(url=Provider.token_endpoint, code=code)

        if "access_token" not in result:
            logging.getLogger(__name__).warning("Token acquisition failed: %s", result.get("error_description"))
            raise HTTPException(status_code=400, detail="Authentication failed")

        user = await Provider._get_user(result["access_token"])

        user_id = user["preferred_username"]
        return User(
            provider_id=user_id,
            id=user_id,
            email=user.get("email", None),
            provider=AuthProvider.OAUTH,
            username=user_id,
            displayName=user_id,
        )
