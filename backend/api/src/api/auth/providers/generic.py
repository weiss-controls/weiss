# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Guilherme de Freitas

from ...models.user import AuthProvider, User


class GenericProvider:
    @staticmethod
    async def set(client_id: str, client_secret: str, issuer: str):
        """Initialiser for provider singleton. Useful if you require a discovery endpoint or similar"""
        pass

    async def create_authorization_url(demo_profile: str | None = None):
        """Create authorisation URL and return it

        Args:
            demo_profile: Demo profile to use - unused in real auth

        Returns:
            Authorisation URL"""
        return {"authorize_url": ""}

    async def handle_auth_callback(code: str, redirect_uri: str) -> User:
        """Handle token exchange and return user object

        Args:
            code: OAuth2 code (optional)
            redirect_uri: Redirect URI (optional)

        Returns:
            User object"""
        return User(
            id="foo",
            provider_id="foo",
            displayName="User McUserface",
            provider=AuthProvider.DEMO,
            email="user@facility.co.uk",
        )
