# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Guilherme de Freitas

from abc import ABC, abstractmethod

from ...models.user import User


class GenericProvider(ABC):
    @staticmethod
    @abstractmethod
    async def set(client_id: str, client_secret: str, issuer: str):
        """Initialiser for provider singleton. Useful if you require a discovery endpoint or similar"""
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    async def create_authorization_url():
        """Create authorisation URL and return it

        Returns:
            Authorisation URL"""
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    async def handle_auth_callback(code: str, redirect_uri: str, state: str | None = None) -> User:
        """Handle token exchange and return user object

        Args:
            code: OAuth2 code (optional)
            redirect_uri: Redirect URI (optional)
            state: OAuth state parameter

        Returns:
            User object"""
        raise NotImplementedError
