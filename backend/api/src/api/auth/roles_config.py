# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import logging
import os
import threading
import tomllib

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_developer_usernames: frozenset[str] = frozenset()

ROLES_CONFIG_PATH = os.getenv("ROLES_CONFIG_PATH", "./roles.toml")


def load_roles_config() -> None:
    """
    Load developer usernames from the TOML config file into the in-memory cache.
    If the file is not found or cannot be parsed, an empty set is used and a
    warning is logged - the server will start normally with everyone as operator.
    """
    global _developer_usernames
    path = ROLES_CONFIG_PATH
    try:
        with open(path, "rb") as f:
            data = tomllib.load(f)
        usernames = data.get("roles", {}).get("developers", [])
        loaded = frozenset(u.strip().lower() for u in usernames if isinstance(u, str) and u.strip())
        with _lock:
            _developer_usernames = loaded
        logger.info("[roles_config]: Loaded %d developer username(s) from %s", len(loaded), path)
    except FileNotFoundError:
        with _lock:
            _developer_usernames = frozenset()
        logger.warning(
            "[roles_config]: Roles config file not found at '%s'. "
            "All users will be granted the operator role until the file is created.",
            path,
        )
    except Exception as exc:
        with _lock:
            _developer_usernames = frozenset()
        logger.error("[roles_config]: Failed to load roles config from '%s': %s", path, exc)


def reload_roles() -> int:
    """Reload the config file and return the number of developer usernames loaded."""
    load_roles_config()
    with _lock:
        return len(_developer_usernames)


def is_developer(username: str) -> bool:
    """Return True if the given username is in the developer list."""
    with _lock:
        return username.lower() in _developer_usernames


# Load on import so the cache is always populated when the module is first used.
load_roles_config()
