# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import os


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


TITLE = "WEISS Backend API"
VERSION = "0.1.0"
APP_HOSTNAME = os.getenv("APP_HOSTNAME", "localhost")
ENABLE_HTTPS = env_bool("ENABLE_HTTPS", False)
DEV_MODE = env_bool("DEV_MODE", False)
ENABLE_DEMO_MODE = env_bool("ENABLE_DEMO_MODE", False)
# Derive FRONTEND_URL for CORS setup.
VITE_DEV_PORT = "5173"
PROTOCOL = "https" if ENABLE_HTTPS else "http"
PORT = f":{VITE_DEV_PORT}" if DEV_MODE else ""
FRONTEND_URL = f"{PROTOCOL}://{APP_HOSTNAME}{PORT}"
