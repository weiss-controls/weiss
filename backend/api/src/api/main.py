# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import auth
from .config import DEMO_MODE, FRONTEND_URL, TITLE, VERSION
from .repos import deployed, staging
from .snapshots import snapshots

# Provider config
AUTH_TENANT_ID = os.getenv("AUTH_TENANT_ID", "common")
AUTH_CLIENT_ID = os.getenv("AUTH_CLIENT_ID")
AUTH_CLIENT_SECRET = os.getenv("AUTH_CLIENT_SECRET")


async def _session_pruner():
    """Background task: remove expired sessions and orphaned users every hour."""
    while True:
        await asyncio.sleep(3600)
        auth.prune_expired_sessions()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DEMO_MODE:
        try:
            if AUTH_CLIENT_ID is None or AUTH_CLIENT_SECRET is None:
                raise ValueError("Missing AUTH_CLIENT_ID or AUTH_CLIENT_SECRET environment variables")
            await auth.Provider.set(client_secret=AUTH_CLIENT_SECRET, client_id=AUTH_CLIENT_ID, issuer=auth.ISSUER)
        except Exception:
            logging.getLogger(__name__).warning(
                "Provider setup failed — authentication will not work until the OIDC issuer is reachable"
            )
    task = asyncio.create_task(_session_pruner())
    yield
    task.cancel()


app = FastAPI(title=TITLE, version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RootInfo(BaseModel):
    service: str
    version: str


class Health(BaseModel):
    status: str


################
# Routes
################
app.include_router(auth.router)
app.include_router(staging.router)
app.include_router(deployed.router)
app.include_router(snapshots.router)


@app.get("/", operation_id="rootInfo", response_model=RootInfo)
async def root():
    return {"service": TITLE, "version": VERSION}


@app.get("/health", operation_id="healthCheck", response_model=Health)
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
