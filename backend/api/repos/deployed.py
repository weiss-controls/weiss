import os
import json
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List
from datetime import datetime
from api.repos.common import (
    FileResponse,
    RepoInfo,
    RepoTreeInfo,
    DeploymentInfo,
    build_path_tree,
    get_repo_info,
    list_all_repositories,
    REPOS_BASE_PATH,
    DEPLOYMENTS_REL_FOLDER,
    CURRENT_SYMLINK,
    DEPLOYMENT_META,
)
from api.auth.auth import get_current_user

router = APIRouter(
    prefix="/api/v1/repos/runtime",
    tags=["OPI Repositories"],
    dependencies=[Depends(get_current_user)],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_current_snapshot_path(repo_id: str) -> str:
    """
    Resolve the path of the currently deployed snapshot for a repo.
    """
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)
    if not os.path.exists(current_link) or not os.path.islink(current_link):
        raise HTTPException(status_code=404, detail="No deployed snapshot available")
    return current_link


def get_current_deployment_meta(repo_id: str) -> dict:
    """
    Return the metadata from deployment.json for the current deployment.
    """
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)
    meta_file = os.path.join(current_link, DEPLOYMENT_META)
    if not os.path.exists(meta_file):
        raise HTTPException(status_code=404, detail="Deployment metadata not found")
    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[RepoInfo], operation_id="listDeployedRepos")
def list_repositories():
    all_repos = list_all_repositories()
    repos_w_deployment: List[RepoInfo] = []
    for repo in all_repos:
        if repo.current_deployment is not None:
            repos_w_deployment.append(repo)
    return repos_w_deployment


@router.get("/tree", response_model=List[RepoTreeInfo], operation_id="getAllDeployedReposTree")
def get_all_repos_tree():
    all_trees = []
    for repo in list_all_repositories():
        if repo.current_deployment is not None:
            snapshot_path = get_current_snapshot_path(repo.id)
            tree = build_path_tree(snapshot_path)
            all_trees.append(RepoTreeInfo(**repo.model_dump(), tree=tree))
    return all_trees


@router.get(
    "/{repo_id}/tree",
    response_model=RepoTreeInfo,
    operation_id="getDeployedRepoTree",
)
def get_deployed_repo_tree(repo_id: str):
    """
    Return the full tree of the currently deployed snapshot
    for a single repository, wrapped in RepoTreeInfo.
    """
    repo = get_repo_info(repo_id)

    if repo.current_deployment is None:
        raise HTTPException(
            status_code=404,
            detail="Repository has no active deployment",
        )

    snapshot_path = get_current_snapshot_path(repo_id)
    tree = build_path_tree(snapshot_path)

    return RepoTreeInfo(
        **repo.model_dump(),
        tree=tree,
    )


@router.get("/{repo_id}/file", response_model=FileResponse, operation_id="getDeployedRepoFile")
def runtime_get_repo_file(
    repo_id: str, path: str = Query(..., description="Path to file inside repository")
):
    """
    Return the content of a file from the currently deployed snapshot.
    """
    snapshot_path = get_current_snapshot_path(repo_id)
    full_path = os.path.join(snapshot_path, path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found in snapshot")

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    return FileResponse(path=path, content=content)


@router.get(
    "/{repo_id}/info", response_model=DeploymentInfo, operation_id="getCurrentDeploymentInfo"
)
def get_current_deployment_info(repo_id: str):
    """
    Return information about the currently deployed snapshot.
    """
    meta = get_current_deployment_meta(repo_id)
    return DeploymentInfo(
        id=meta["deployment_id"],
        repo_id=meta["repo_id"],
        ref=meta["ref"],
        commit_hash=meta["commit_hash"],
        deployed_at=datetime.fromisoformat(meta["deployed_at"]),
    )
