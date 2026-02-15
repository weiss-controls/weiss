import os


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


TITLE = "WEISS Backend API"
VERSION = "0.1.0"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ENABLE_HTTPS = env_bool("ENABLE_HTTPS", False)
