# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Guilherme de Freitas, André Favoto

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from ...config import FRONTEND_URL
from ...models.user import AuthProvider, User, UserRole
from .generic import GenericProvider

_pending_states: dict[str, datetime] = {}
_STATE_TTL_MINUTES = 10


class Provider(GenericProvider):
    @staticmethod
    async def set(client_id: str, client_secret: str, issuer: str):
        # Demo provider has no remote setup phase.
        return

    @staticmethod
    async def create_authorization_url(demo_role: UserRole | None = None):
        if not demo_role or demo_role not in list(UserRole):
            raise HTTPException(status_code=400, detail="Invalid or missing demo role")

        dummy_code = f"demo_code_{demo_role.value}"
        state = f"demo:{secrets.token_urlsafe(16)}"
        _pending_states[state] = datetime.now(timezone.utc) + timedelta(minutes=_STATE_TTL_MINUTES)
        redirect_url = f"{FRONTEND_URL}/auth/callback?code={dummy_code}&state={state}"
        return {"authorize_url": redirect_url}

    @staticmethod
    async def handle_auth_callback(code: str, redirect_uri: str, state: str | None = None):
        expiry = _pending_states.pop(state, None) if state else None
        if expiry is None or expiry < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invalid or expired auth state")

        demo_role = code.split("_")[-1]
        if demo_role not in {r.value for r in UserRole}:
            raise HTTPException(status_code=400, detail="Invalid demo profile")

        return User(
            id=f"demo-{demo_role}",
            username=f"weiss-demo-{demo_role.lower()}",
            displayName=f"Demo {demo_role.capitalize()}",
            email="weiss-dummy@email",
            provider=AuthProvider.DEMO,
            provider_id=AuthProvider.DEMO.value,
            role=UserRole(demo_role),
        )
