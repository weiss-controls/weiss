# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from api.auth import auth
from api.repos import staging, deployed
from api.config import FRONTEND_URL, TITLE, VERSION


async def _session_pruner():
    """Background task: remove expired sessions and orphaned users every hour."""
    while True:
        await asyncio.sleep(3600)
        auth.prune_expired_sessions()


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.get("/", operation_id="rootInfo", response_model=RootInfo)
async def root():
    return {"service": TITLE, "version": VERSION}


@app.get("/health", operation_id="healthCheck", response_model=Health)
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
