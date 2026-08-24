# SPDX-License-Identifier: GPL-3.0-or-later
# Snapshot save/restore backend API for WEISS
# Contributed by Elmaddin Guliyev

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth import get_current_user

SNAPSHOTS_BASE_PATH = "/app/storage/snapshots"
os.makedirs(SNAPSHOTS_BASE_PATH, exist_ok=True)

router = APIRouter(
    prefix="/api/v1/snapshots",
    tags=["PV Snapshots"],
    dependencies=[Depends(get_current_user)],
)


# ── Models ──


class SnapshotPVData(BaseModel):
    value: Any
    alarm: Optional[Dict[str, Any]] = None
    timeStamp: Optional[Dict[str, Any]] = None
    b64arr: Optional[str] = None
    b64dtype: Optional[str] = None


class SnapshotSaveRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Snapshot name")
    opi_file: str = Field(..., description="OPI file path this snapshot belongs to")
    pvs: Dict[str, SnapshotPVData] = Field(..., description="PV name to value mapping")


class SnapshotEntry(BaseModel):
    id: str
    name: str
    opi_file: str
    timestamp: str
    pv_count: int


class SnapshotDetail(SnapshotEntry):
    pvs: Dict[str, SnapshotPVData]


# ── Helpers ──


def _opi_dir(opi_file: str) -> str:
    """Get snapshot directory for an OPI file."""
    safe_name = opi_file.replace("/", "_").replace("\\", "_").replace("..", "")
    dir_path = os.path.join(SNAPSHOTS_BASE_PATH, safe_name)
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def _snapshot_path(opi_file: str, snapshot_id: str) -> str:
    return os.path.join(_opi_dir(opi_file), f"{snapshot_id}.json")


def _generate_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


# ── Endpoints ──


@router.put(
    "",
    operation_id="saveSnapshot",
    response_model=SnapshotEntry,
    summary="Save a PV snapshot",
)
async def save_snapshot(request: SnapshotSaveRequest = Body(...)):
    """Save current PV values as a named snapshot for an OPI file."""
    snapshot_id = _generate_id()
    timestamp = datetime.now(timezone.utc).isoformat()

    snapshot_data = {
        "id": snapshot_id,
        "name": request.name,
        "opi_file": request.opi_file,
        "timestamp": timestamp,
        "pv_count": len(request.pvs),
        "pvs": {pv: data.model_dump() for pv, data in request.pvs.items()},
    }

    filepath = _snapshot_path(request.opi_file, snapshot_id)
    with open(filepath, "w") as f:
        json.dump(snapshot_data, f, indent=2)

    return SnapshotEntry(
        id=snapshot_id,
        name=request.name,
        opi_file=request.opi_file,
        timestamp=timestamp,
        pv_count=len(request.pvs),
    )


@router.get(
    "",
    operation_id="listSnapshots",
    response_model=List[SnapshotEntry],
    summary="List all snapshots for an OPI file",
)
async def list_snapshots(opi_file: str = Query(..., description="OPI file path")):
    """List all saved snapshots for a given OPI file."""
    dir_path = _opi_dir(opi_file)
    snapshots: List[SnapshotEntry] = []

    if not os.path.exists(dir_path):
        return snapshots

    for filename in sorted(os.listdir(dir_path), reverse=True):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(dir_path, filename)
        try:
            with open(filepath) as f:
                data = json.load(f)
            snapshots.append(
                SnapshotEntry(
                    id=data["id"],
                    name=data["name"],
                    opi_file=data["opi_file"],
                    timestamp=data["timestamp"],
                    pv_count=data["pv_count"],
                )
            )
        except (json.JSONDecodeError, KeyError):
            continue

    return snapshots


@router.get(
    "/{snapshot_id}",
    operation_id="getSnapshot",
    response_model=SnapshotDetail,
    summary="Get a snapshot with all PV values",
)
async def get_snapshot(
    snapshot_id: str,
    opi_file: str = Query(..., description="OPI file path"),
):
    """Get full snapshot data including all PV values."""
    filepath = _snapshot_path(opi_file, snapshot_id)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Snapshot not found")

    with open(filepath) as f:
        data = json.load(f)

    return SnapshotDetail(**data)


@router.delete(
    "/{snapshot_id}",
    operation_id="deleteSnapshot",
    summary="Delete a snapshot",
)
async def delete_snapshot(
    snapshot_id: str,
    opi_file: str = Query(..., description="OPI file path"),
):
    """Delete a saved snapshot."""
    filepath = _snapshot_path(opi_file, snapshot_id)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Snapshot not found")

    os.remove(filepath)
    return {"deleted": True, "id": snapshot_id}
