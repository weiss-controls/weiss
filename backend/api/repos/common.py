import os
import json
from pydantic import BaseModel
from typing import List, Optional, Literal, Tuple
from datetime import datetime

# Abs paths inside container - adjust if running locally
REPOS_BASE_PATH = "/app/storage/repos"
SSH_KEY_PATH = "/root/.ssh/id_rsa"
SSH_KNOWN_HOSTS_PATH = "/root/.ssh/known_hosts"
##
STAGING_REL_FOLDER = "staging"
DEPLOYMENTS_REL_FOLDER = "deployments"
SNAPSHOT_REL_FOLDER = "snapshot"
CURRENT_SYMLINK = "current"
DEPLOYMENT_META = "deployment.json"
REPO_META = "repo.json"
NEW_FILE_CONTENT = [
    {
        "id": "__grid__",
        "widgetName": "GridZone",
        "properties": {
            "backgroundColor": "#e9ecef",
            "gridLineColor": "#dee2e6",
            "gridSize": 5,
            "gridLineVisible": True,
            "snapToGrid": True,
            "centerVisible": True,
            "macros": {},
        },
    }
]
os.makedirs(REPOS_BASE_PATH, exist_ok=True)


class FileResponse(BaseModel):
    path: str
    content: str
    encoding: str = "utf-8"


class GitFileStatus(BaseModel):
    path: str
    status: Literal["modified", "added", "deleted", "renamed", "untracked"]


class GitWorkingTreeStatus(BaseModel):
    dirty: bool
    files: List[GitFileStatus]


class RepoInfo(BaseModel):
    id: str
    alias: str
    git_url: str
    created_at: str
    refs: List[str]
    checked_out_ref: str
    current_deployment: Optional[str] = None
    deployed_ref: Optional[str] = None
    deployed_at: Optional[str] = None


class TreeNode(BaseModel):
    name: str
    path: str  # path relative to repo/snapshot root
    type: Literal["file", "directory"]
    children: Optional[List["TreeNode"]] = None


class RepoTreeInfo(RepoInfo):
    tree: List[TreeNode]
    working_tree_status: Optional[GitWorkingTreeStatus] = None


class DeploymentInfo(BaseModel):
    id: str
    repo_id: str
    ref: str
    commit_hash: str
    deployed_at: Optional[str] = None


def build_path_tree(root_path: str, rel_path: str = "") -> List[TreeNode]:
    """
    Recursively build a directory tree starting at root_path/rel_path.

    - Skips metadata directories (e.g. .git)
    - Includes only .json files
    - Paths are returned relative to root_path
    """
    abs_path = os.path.join(root_path, rel_path)
    nodes: List[TreeNode] = []
    IGNORE_DIRS = {".git", ".hg", ".svn", "__pycache__"}
    try:
        entries = sorted(
            os.scandir(abs_path),
            key=lambda e: (not e.is_dir(follow_symlinks=False), e.name),
        )
    except FileNotFoundError:
        return []

    for entry in entries:
        if entry.is_dir(follow_symlinks=False) and entry.name in IGNORE_DIRS:
            continue

        entry_rel_path = os.path.join(rel_path, entry.name)

        if entry.is_dir(follow_symlinks=False):
            children = build_path_tree(root_path, entry_rel_path)
            nodes.append(
                TreeNode(
                    name=entry.name,
                    path=entry_rel_path,
                    type="directory",
                    children=children,
                )
            )
        else:
            if entry.name in [REPO_META, DEPLOYMENT_META] or not entry.name.lower().endswith(
                ".json"
            ):
                continue

            nodes.append(
                TreeNode(
                    name=entry.name,
                    path=entry_rel_path,
                    type="file",
                )
            )

    return nodes


def get_repo_info(repo_id: str) -> Tuple[(str, RepoInfo)]:
    """Get content of repository metadata file (repo.json)"""
    meta_file_path = os.path.join(REPOS_BASE_PATH, repo_id, REPO_META)
    if not os.path.exists(meta_file_path):
        raise FileNotFoundError
    with open(meta_file_path) as f:
        repo_meta = json.load(f)
    return meta_file_path, RepoInfo(**repo_meta)


def list_all_repositories() -> List[RepoInfo]:
    """List all registered repositories"""
    repos = []
    repos_base = os.path.join(REPOS_BASE_PATH)
    if not os.path.exists(repos_base):
        return repos

    for repo_id in os.listdir(repos_base):
        meta_file = os.path.join(repos_base, repo_id, REPO_META)
        if os.path.exists(meta_file):
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
                repos.append(
                    RepoInfo(
                        id=meta["id"],
                        alias=meta["alias"],
                        git_url=meta["git_url"],
                        created_at=meta["created_at"],
                        refs=meta["refs"],
                        checked_out_ref=meta["checked_out_ref"],
                        deployed_ref=meta.get("deployed_ref"),
                        deployed_at=meta.get("deployed_at"),
                        current_deployment=meta.get("current_deployment"),
                    )
                )
    return repos


REGISTERED_REPO_URLS = []
# initialize registered repos on startup
for repo in list_all_repositories():
    REGISTERED_REPO_URLS.append(repo.git_url)
