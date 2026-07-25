# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from fastapi import HTTPException

from ..config import FRONTEND_URL
from ..models.user import AuthProvider, User, UserRole


class Provider:
    def fetch_token():
        pass

    def create_authorization_url(demo_profile: UserRole | None = None):
        if not demo_profile or demo_profile not in [role.value for role in UserRole]:
            raise HTTPException(status_code=400, detail="Invalid or missing demo profile")

        dummy_code = f"demo_code_{demo_profile.value}"
        redirect_url = f"{FRONTEND_URL}/auth/callback?code={dummy_code}&state=demo"
        return {"authorize_url": redirect_url}

    async def handle_auth_callback(code: str, redirect_uri: str):
        demo_role = code.split("_")[-1]
        if demo_role not in {r.value for r in UserRole}:
            raise HTTPException(status_code=400, detail="Invalid demo profile")

        return User(
            id="foo",
            username=f"weiss-demo-{demo_role.lower()}",
            displayName=f"Demo {demo_role.value.capitalize()}",
            email="weiss-dummy@email",
            provider=AuthProvider.DEMO,
            provider_id=AuthProvider.DEMO.value,
        )
