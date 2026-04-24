# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import os
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List
from api.repos.common import (
    FileResponse,
    DeploymentMeta,
    TreeNode,
    build_path_tree,
    get_repo_meta,
    list_all_repositories,
    REPOS_BASE_PATH,
    DEPLOYMENTS_REL_FOLDER,
    CURRENT_SYMLINK,
)
from api.auth.auth import get_current_user

router = APIRouter(
    prefix="/api/v1/repos/runtime",
    tags=["OPI Repositories"],
    dependencies=[Depends(get_current_user)],
)


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------


class DeploymentTreeInfo(DeploymentMeta):
    tree: List[TreeNode]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_current_snapshot_path(repo_id: str) -> str:
    """
    Resolve the path of the currently deployed snapshot for a repo.
    """
    current_link = os.path.join(
        REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK
    )
    if not os.path.exists(current_link) or not os.path.islink(current_link):
        raise HTTPException(status_code=404, detail="No deployed snapshot available")
    return current_link


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[DeploymentMeta], operation_id="listDeployedRepos")
def list_repositories():
    all_repos = list_all_repositories()
    repos_w_deployment: List[DeploymentMeta] = []
    for repo in all_repos:
        if repo.current_deployment is not None:
            repos_w_deployment.append(DeploymentMeta(**repo.model_dump()))
    return repos_w_deployment


@router.get(
    "/tree",
    response_model=List[DeploymentTreeInfo],
    operation_id="getAllDeployedReposTree",
)
def get_all_repos_tree():
    all_trees = []
    for repo in list_all_repositories():
        if repo.current_deployment is not None:
            snapshot_path = get_current_snapshot_path(repo.id)
            tree = build_path_tree(snapshot_path)
            all_trees.append(DeploymentTreeInfo(**repo.model_dump(), tree=tree))
    return all_trees


@router.get(
    "/{repo_id}/tree",
    response_model=DeploymentTreeInfo,
    operation_id="getDeployedRepoTree",
)
def get_deployed_repo_tree(repo_id: str):
    """
    Return the full tree of the currently deployed snapshot
    for a single repository, wrapped in DeploymentTreeInfo.
    """
    _, repo = get_repo_meta(repo_id)

    if repo.current_deployment is None:
        raise HTTPException(
            status_code=404,
            detail="Repository has no active deployment",
        )

    snapshot_path = get_current_snapshot_path(repo_id)
    tree = build_path_tree(snapshot_path)

    return DeploymentTreeInfo(
        **repo.model_dump(),
        tree=tree,
    )


@router.get(
    "/{repo_id}/file", response_model=FileResponse, operation_id="getDeployedRepoFile"
)
def runtime_get_repo_file(
    repo_id: str, path: str = Query(..., description="Path to file inside repository")
):
    """
    Return the content of a file from the currently deployed snapshot.
    """
    snapshot_path = get_current_snapshot_path(repo_id)
    rel_path = os.path.normpath(path).lstrip(os.sep)
    if not rel_path or rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid file path")
    full_path = os.path.join(snapshot_path, rel_path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found in snapshot")

    _, ext = os.path.splitext(path)
    if ext.lower() in {".png", ".jpg", ".jpeg"}:
        import base64

        with open(full_path, "rb") as f:
            content = base64.b64encode(f.read()).decode("ascii")
        return FileResponse(path=path, content=content, encoding="base64")

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    return FileResponse(path=path, content=content)
