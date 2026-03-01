# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import os
import uuid
import subprocess
import json
import base64
from .common import REPOS_BASE_PATH, BARE_CLONE_NAME
from fastapi import APIRouter, HTTPException, Body, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Tuple
from datetime import datetime, timezone
from api.auth.roles import require_developer, User
from api.repos.common import (
    FileResponse,
    RepoMeta,
    RepoInfo,
    RepoTreeInfo,
    DeploymentInfo,
    GitFileStatus,
    GitWorkingTreeStatus,
    get_repo_meta,
    build_path_tree,
    list_all_repositories,
    DEPLOYMENTS_REL_FOLDER,
    WORKTREES_REL_FOLDER,
    CURRENT_SYMLINK,
    REPO_META,
    DEPLOYMENT_META,
    REGISTERED_REPO_URLS,
    NEW_FILE_CONTENT,
)

router = APIRouter(
    prefix="/api/v1/repos/staging",
    tags=["[Admin] OPI management"],
    dependencies=[Depends(require_developer)],
)
TECHNICAL_ACCOUNT_TOKEN = os.getenv("TECHNICAL_ACCOUNT_TOKEN")
TECHNICAL_ACCOUNT_USERNAME = os.getenv("TECHNICAL_ACCOUNT_USERNAME", "weiss-bot")
TECHNICAL_ACCOUNT_EMAIL = os.getenv("TECHNICAL_ACCOUNT_EMAIL", "weiss-bot@dummy")
auth_cmd = None
if TECHNICAL_ACCOUNT_TOKEN:
    # TODO: actually check if token is valid
    token = TECHNICAL_ACCOUNT_TOKEN.strip()
    auth_header = (
        f"Authorization: Basic {base64.b64encode(('weiss-bot:' + token).encode()).decode()}"
    )
    auth_cmd = ["-c", f"http.extraHeader={auth_header}"]
os.environ["GIT_ASKPASS"] = "echo"
os.environ["GIT_TERMINAL_PROMPT"] = "0"
os.environ["GIT_HTTP_USER_AGENT"] = "WEISS/1.0"
subprocess.run(["git", "config", "--global", "user.name", TECHNICAL_ACCOUNT_USERNAME], check=True)
subprocess.run(["git", "config", "--global", "user.email", TECHNICAL_ACCOUNT_EMAIL], check=True)


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RepoCreateRequest(BaseModel):
    alias: str = Field(..., description="Local OPI repository name")
    git_url: str = Field(..., description="Git repository URL")


class RepoRef(BaseModel):
    ref: str


class ValidationResult(BaseModel):
    valid: bool
    errors: List[str] = []


class DeployRequest(BaseModel):
    deployment_version: str  # tag or commit hash to deploy


class FileUpdateRequest(BaseModel):
    content: str = Field(..., description="Full file content to write")


class CommitRequest(BaseModel):
    message: str = Field(..., description="Git commit message")
    tag: str | None = Field(None, description="Optional Git tag to add after commit")


class PathCreateRequest(BaseModel):
    path: str = Field(..., description="Path to create, relative to repo root")
    type: str = Field(
        ...,
        description="Type of path to create: 'file' or 'directory'.",
        pattern="^(file|directory)$",
    )


# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
def run_git(cmd: list[str], cwd: str | None = None, allow_fail: bool = False) -> str:
    """Run git command and raise exception if allow_fail==False (default)"""
    try:
        if auth_cmd:
            result = subprocess.run(
                ["git"] + auth_cmd + cmd, cwd=cwd, check=True, capture_output=True, text=True
            )
        else:
            result = subprocess.run(
                ["git"] + cmd, cwd=cwd, check=True, capture_output=True, text=True
            )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        if allow_fail:
            return ""
        raise HTTPException(status_code=500, detail=f"Git command failed: {e.stderr}")


def ensure_clean(repo_path: str):
    dirty = run_git(["status", "--porcelain"], cwd=repo_path)
    if dirty.strip():
        raise HTTPException(
            status_code=409,
            detail="Working tree has uncommitted changes. Commit or reset first.",
        )


def get_default_branch(repo_path: str):
    head_info = run_git(["remote", "show", "origin"], cwd=repo_path).splitlines()
    default_branch = "main"  # default fallback
    for line in head_info:
        if "HEAD branch" in line:
            default_branch = line.split(":")[-1].strip()
            break
    return default_branch


def clone(git_url: str, repo_id: str) -> str:
    if git_url in REGISTERED_REPO_URLS:
        raise HTTPException(status_code=403, detail="Repository already registered")

    if not git_url.startswith("https://"):
        raise HTTPException(
            status_code=400,
            detail="Invalid URL. Only HTTPS repositories can be registered.",
        )

    repo_path = os.path.join(REPOS_BASE_PATH, repo_id, BARE_CLONE_NAME)
    run_git(["clone", "--bare", "--recursive", git_url, repo_path])
    return repo_path


def get_user_worktree_path(repo_id: str, user: User) -> str:
    worktree_base = os.path.join(REPOS_BASE_PATH, repo_id, WORKTREES_REL_FOLDER)
    os.makedirs(worktree_base, exist_ok=True)
    path = os.path.join(worktree_base, user.id)
    bare_repo = os.path.join(REPOS_BASE_PATH, repo_id, BARE_CLONE_NAME)

    if not os.path.exists(path):
        # create worktree on default branch
        default_branch = get_default_branch(bare_repo)
        run_git(["fetch", "origin", default_branch], cwd=bare_repo)
        run_git(
            ["worktree", "add", path, "-b", user.id, default_branch],
            cwd=bare_repo,
        )

    return path


def get_working_tree_status(repo_path: str) -> GitWorkingTreeStatus:
    raw = run_git(
        ["status", "--porcelain"],
        cwd=repo_path,
    )

    files: list[GitFileStatus] = []

    for line in raw.splitlines():
        code = line[:2]
        path = line[3:]

        if code == "??":
            status = "untracked"
        elif "D" in code:
            status = "deleted"
        elif "A" in code:
            status = "added"
        else:
            status = "modified"

        files.append(GitFileStatus(path=path, status=status))

    return GitWorkingTreeStatus(
        dirty=bool(files),
        files=files,
    )


def get_checked_out_ref(repo_id: str, user: User):
    repo_path = get_user_worktree_path(repo_id, user)
    repo_head = run_git(["rev-parse", "HEAD"], cwd=repo_path).strip()
    tag = run_git(
        ["describe", "--tags", "--exact-match", repo_head], cwd=repo_path, allow_fail=True
    ).strip()
    return tag if tag else repo_head


def create_snapshot(
    repo_id: str, ref: str, user: User = Depends(require_developer)
) -> Tuple[str, str]:
    """
    Create a read-only snapshot of the repo at a given ref.

    Returns:
        deployment_id, snapshot_path
    """
    repo_path = get_user_worktree_path(repo_id, user)
    ensure_clean(repo_path)
    deployment_id = str(uuid.uuid4())
    deployments_root = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER)
    os.makedirs(deployments_root, exist_ok=True)
    deployment_path = os.path.join(deployments_root, deployment_id)
    run_git(["clone", "--recursive", repo_path, deployment_path])
    run_git(["checkout", ref], cwd=deployment_path)

    return deployment_id, deployment_path


def validate_repo_content(repo_path: str, ref: str) -> ValidationResult:
    """Validate that the repo at given ref contains required OPI files"""
    # @TODO
    return ValidationResult(valid=True, errors=[])


@router.get("/", response_model=List[RepoInfo], operation_id="listRepos")
def list_repositories():
    return list_all_repositories()


@router.get("/tree", response_model=List[RepoTreeInfo], operation_id="getAllReposTree")
def get_all_repos_tree(user: User = Depends(require_developer)):
    all_trees = []
    for repo in list_all_repositories():
        repo_path = get_user_worktree_path(repo.id, user)
        tree = build_path_tree(repo_path)
        wts = get_working_tree_status(repo_path)
        current_checkout = get_checked_out_ref(repo.id, user)
        all_trees.append(
            RepoTreeInfo(
                **repo.model_dump(),
                refs=list_repository_refs(repo.id, user),
                checked_out_ref=current_checkout,
                tree=tree,
                working_tree_status=wts,
            )
        )
    return all_trees


@router.post("/register", response_model=List[RepoTreeInfo], operation_id="registerRepo")
def register_repository(payload: RepoCreateRequest, user: User = Depends(require_developer)):
    """Register a Git repository and create a clone"""
    repo_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    clone(payload.git_url, repo_id)
    REGISTERED_REPO_URLS.append(payload.git_url)

    repo_meta = RepoMeta(
        id=repo_id,
        alias=payload.alias,
        git_url=payload.git_url,
        created_at=created_at,
    )

    meta_file = os.path.join(REPOS_BASE_PATH, repo_meta.id, REPO_META)
    with open(meta_file, "w", encoding="utf-8") as f:
        f.write(repo_meta.model_dump_json(indent=2))
    # TODO: store all repos tree and edit in place instead of recalculating
    return get_all_repos_tree(user)


@router.delete(
    "/{repo_id}/unregister", response_model=List[RepoTreeInfo], operation_id="unregisterRepo"
)
def unregister_repository(repo_id: str, user: User = Depends(require_developer)):
    """
    Remove a repository completely:
    - Delete staging folder
    - Delete all deployments
    - Remove repo metadata
    - Remove from REGISTERED_REPO_URLS
    """
    repo_base = os.path.join(REPOS_BASE_PATH, repo_id)
    repo_meta_path = os.path.join(repo_base, REPO_META)

    if not os.path.exists(repo_meta_path):
        raise HTTPException(status_code=404, detail="Repository not found")

    # Load repo info to remove git_url from registered URLs
    with open(repo_meta_path, "r", encoding="utf-8") as f:
        repo_meta_data = json.load(f)
    git_url = repo_meta_data.get("git_url")
    if git_url in REGISTERED_REPO_URLS:
        REGISTERED_REPO_URLS.remove(git_url)

    # Remove repository folder
    try:
        if os.path.exists(repo_base):
            import shutil

            shutil.rmtree(repo_base)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete repository: {str(e)}")
    # TODO: store all repos tree and edit in place instead of recalculating
    return get_all_repos_tree(user)


@router.get("/{repo_id}/refs", response_model=list[str], operation_id="listRepoRefs")
def list_repository_refs(repo_id: str, user: User = Depends(require_developer)) -> list[str]:
    """List 20 latest repository refs available. Assumes repo is up to date.
    If commit is tagged, show tag instead.
    """
    repo_path = get_user_worktree_path(repo_id, user)
    default_branch = get_default_branch(repo_path)
    commits = run_git(
        ["rev-list", "--max-count=20", default_branch],
        cwd=repo_path,
    ).splitlines()

    tag_refs = run_git(["show-ref", "--tags"], cwd=repo_path, allow_fail=True).splitlines()
    commit_to_tag = {}
    for line in tag_refs:
        sha, ref = line.split()
        tag = ref.replace("refs/tags/", "")
        commit_to_tag[sha] = tag

    refs: list[str] = []
    for sha in commits:
        if sha in commit_to_tag:
            refs.append(commit_to_tag[sha])
        else:
            refs.append(sha)

    return refs


@router.post("/{repo_id}/sync", response_model=RepoTreeInfo, operation_id="syncRepo")
def update_repo(repo_id: str, user: User = Depends(require_developer)):
    """Fetch new tags/commits from default branch and rebase current worktree onto it."""
    repo_path = get_user_worktree_path(repo_id, user)
    default_branch = get_default_branch(repo_path)
    is_dirty = bool(run_git(["status", "--porcelain"], cwd=repo_path).strip())

    if is_dirty:
        run_git(["stash", "push", "--include-untracked"], cwd=repo_path)
    # update default branch
    run_git(["fetch", "origin", f"{default_branch}:{default_branch}"], cwd=repo_path)

    try:
        run_git(["rebase", default_branch], cwd=repo_path)
    except HTTPException:
        run_git(["rebase", "--abort"], cwd=repo_path)
        if is_dirty:
            # Restore original workspace state
            run_git(["stash", "apply"], cwd=repo_path)
            run_git(["stash", "drop"], cwd=repo_path)
        raise HTTPException(
            status_code=409,
            detail="Failed to rebase. Aborting commit. Please checkout to latest ref to apply your changes.",
        )

    # Only reached if rebase succeeded
    if is_dirty:
        try:
            run_git(["stash", "apply"], cwd=repo_path)
        except HTTPException:
            raise HTTPException(
                status_code=409,
                detail="Local changes conflict with latest updates. Please start from latest ref or resolve conflicts manually. Aborting.",
            )

        conflicts = run_git(
            ["diff", "--name-only", "--diff-filter=U"],
            cwd=repo_path,
        )
        if conflicts.strip():
            raise HTTPException(
                status_code=409,
                detail="Local changes conflict with latest updates. Please start from latest ref or resolve conflicts manually. Aborting.",
            )

        run_git(["stash", "drop"], cwd=repo_path)
        run_git(["add", "."], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.get("/{repo_id}/file", response_model=FileResponse, operation_id="getStagingRepoFile")
def staging_get_repo_file(
    repo_id: str,
    path: str = Query(..., description="Path to file inside repository"),
    user: User = Depends(require_developer),
):
    """
    Return the content of a file from the current state of staging repo.
    """
    file_path = get_user_worktree_path(repo_id, user)
    full_path = os.path.join(file_path, path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    return FileResponse(path=path, content=content)


@router.put(
    "/{repo_id}/file",
    operation_id="updateStagingRepoFile",
    response_model=RepoTreeInfo,
)
def staging_update_repo_file(
    repo_id: str,
    path: str = Query(
        ..., description="Path to existing file inside repository (relative to root)"
    ),
    payload: FileUpdateRequest = Body(...),
    user: User = Depends(require_developer),
):
    """
    Overwrite the contents of an existing file in the staging repository.
    Path must always be relative to repo root.
    Fails if the file does not already exist.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    # Normalize and validate path
    rel_path = os.path.normpath(path).lstrip(os.sep)
    if rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid file path")

    full_path = os.path.join(repo_path, rel_path)

    # Must exist and be a regular file
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.isfile(full_path):
        raise HTTPException(
            status_code=400,
            detail="Target path is not a file",
        )

    try:
        with open(full_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(payload.content.rstrip() + "\n")
        run_git(["add", "."], cwd=repo_path)
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update file: {str(e)}",
        )
    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/file/reset",
    response_model=RepoTreeInfo,
    operation_id="resetStagingRepoFile",
)
def reset_staging_repo_file(
    repo_id: str,
    path: str = Query(..., description="Path to file inside repository (relative to root)"),
    user: User = Depends(require_developer),
):
    """
    Reset changes of a single file in the staging repository.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    # Normalize and validate path
    rel_path = os.path.normpath(path).lstrip(os.sep)
    if rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid file path")

    full_path = os.path.join(repo_path, rel_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    run_git(["restore", "--staged", rel_path], cwd=repo_path)
    run_git(["restore", rel_path], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/reset",
    response_model=RepoTreeInfo,
    operation_id="resetStagingRepo",
)
def reset_staging_repo(
    repo_id: str,
    user: User = Depends(require_developer),
):
    """
    Return the staging repository to the checked-out ref.
    This discards all local changes, including untracked files and directories.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    # Unstage everything, then restore working tree
    run_git(["restore", "--staged", "."], cwd=repo_path)
    run_git(["restore", "."], cwd=repo_path)
    run_git(["clean", "-fd"], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/path",
    response_model=RepoTreeInfo,
    operation_id="createStagingRepoPath",
)
def create_staging_repo_path(
    repo_id: str,
    payload: PathCreateRequest,
    user: User = Depends(require_developer),
):
    """
    Create a file or directory in the staging repository.
    - Intermediate directories will be created if necessary.
    - Directories get a .gitkeep file to ensure they are tracked by Git.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    rel_path = os.path.normpath(payload.path).lstrip(os.sep)
    if rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid path")

    full_path = os.path.join(repo_path, rel_path)
    parent_dir = os.path.dirname(full_path)

    if os.path.exists(full_path):
        raise HTTPException(status_code=400, detail="File or directory already exists")

    try:
        os.makedirs(parent_dir, exist_ok=True)

        if payload.type == "file":
            # Create empty file
            if not full_path.endswith(".json"):
                full_path += ".json"
            with open(full_path, "w", encoding="utf-8") as f:
                json.dump(NEW_FILE_CONTENT, f, indent=2)
                f.write("\n")
            run_git(["add", full_path], cwd=repo_path)
        elif payload.type == "directory":
            # Create directory and .gitkeep
            os.makedirs(full_path, exist_ok=True)
            gitkeep = os.path.join(full_path, ".gitkeep")
            open(gitkeep, "w").close()
            run_git(["add", full_path], cwd=repo_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to create {payload.type}: {str(e)}")

    return get_staging_repo_tree(repo_id, user)


@router.delete(
    "/{repo_id}/path",
    response_model=RepoTreeInfo,
    operation_id="deleteStagingRepoPath",
)
def delete_staging_repo_path(
    repo_id: str,
    path: str = Query(
        ...,
        description="FIle or directory path inside repository, relative to root.",
    ),
    user: User = Depends(require_developer),
):
    """
    Delete a file or directory from the staging repository.
    Directories are deleted recursively.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    rel_path = os.path.normpath(path).lstrip(os.sep)
    if rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid path")

    full_path = os.path.join(repo_path, rel_path)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Path not found")

    if os.path.isdir(full_path):
        run_git(["rm", "-r", "-f", "--", rel_path], cwd=repo_path)
    else:
        run_git(["rm", "-f", "--", rel_path], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/commit",
    response_model=RepoTreeInfo,
    operation_id="commitStagingRepo",
)
def commit_staging_repo(
    repo_id: str, payload: CommitRequest, user: User = Depends(require_developer)
):
    """
    Commit staged changes in the staging repository and push to remote.
    If HEAD is behind remote, try rebasing first.
    Fails if there is nothing to commit.
    """
    repo_path = get_user_worktree_path(repo_id, user)
    default_branch = get_default_branch(repo_path)

    # Ensure there is something staged
    staged = run_git(["diff", "--cached", "--name-only"], cwd=repo_path)
    if not staged.strip():
        raise HTTPException(status_code=400, detail="No staged changes to commit")
    if not TECHNICAL_ACCOUNT_TOKEN:
        raise HTTPException(status_code=400, detail="Technical account token not configured")
    # make sure HEAD is rebased to main tip before comitting
    update_repo(repo_id, user)
    try:
        run_git(
            [
                "commit",
                f'--author="{user.displayName} <{user.email}>"',
                "-m",
                payload.message,
                "-m",
                f"Committed by WEISS on behalf of @{user.username}",
            ],
            cwd=repo_path,
        )
    except HTTPException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit changes: {e.detail}",
        )
    try:
        default_branch = get_default_branch(repo_path)
        run_git(["push", "origin", f"HEAD:{default_branch}"], cwd=repo_path)

        if payload.tag:
            run_git(["tag", payload.tag], cwd=repo_path)
            run_git(["push", "origin", payload.tag], cwd=repo_path)

    except HTTPException as e:
        # undo previous commit but keep changes staged
        run_git(["reset", "--soft", "HEAD^1"], cwd=repo_path)
        raise HTTPException(
            status_code=409,
            detail=f"Failed to push changes: {e.detail}. Aborted.",
        )

    return get_staging_repo_tree(repo_id, user)


@router.post("/{repo_id}/deploy", response_model=DeploymentInfo, operation_id="deployRepo")
def deploy_repo(repo_id: str, payload: DeployRequest, user: User = Depends(require_developer)):
    """Deploy a selected tag or commit to make it available for users"""
    ref_to_deploy = payload.deployment_version
    try:
        deployment_id, snapshot_path = create_snapshot(repo_id, ref_to_deploy, user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create snapshot: {str(e)}")
    commit_hash = run_git(["rev-parse", ref_to_deploy], cwd=snapshot_path)
    deployment_meta = {
        "deployment_id": deployment_id,
        "repo_id": repo_id,
        "ref": ref_to_deploy,
        "commit_hash": commit_hash,
        "deployed_at": datetime.now(timezone.utc).isoformat(),
    }
    deployment_meta_path = os.path.join(
        REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, deployment_id, DEPLOYMENT_META
    )
    with open(deployment_meta_path, "w") as f:
        json.dump(deployment_meta, f, indent=2)

    repo_meta_path, repo_meta = get_repo_meta(repo_id)
    repo_meta.current_deployment = deployment_id
    repo_meta.deployed_ref = ref_to_deploy
    repo_meta.deployed_at = deployment_meta["deployed_at"]

    with open(repo_meta_path, "w") as f:
        f.write(repo_meta.model_dump_json(indent=2))
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)
    if os.path.islink(current_link) or os.path.exists(current_link):
        os.remove(current_link)
    os.symlink(snapshot_path, current_link)
    return DeploymentInfo(
        id=deployment_id,
        repo_id=repo_id,
        ref=ref_to_deploy,
        commit_hash=commit_hash,
        deployed_at=deployment_meta["deployed_at"],
    )


@router.post("/{repo_id}/undeploy", operation_id="undeployRepo")
def undeploy_repository(repo_id: str):
    """
    Remove the current deployment for a repository:
    - Delete symlink to current deployment
    - Clear current deployment metadata in repo info
    """
    _, repo_meta = get_repo_meta(repo_id)
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)

    if os.path.islink(current_link) or os.path.exists(current_link):
        try:
            os.remove(current_link)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to remove current deployment link: {str(e)}"
            )

    # Clear deployment info
    repo_meta.current_deployment = None
    repo_meta.deployed_ref = None
    repo_meta.deployed_at = None
    repo_meta_path = os.path.join(REPOS_BASE_PATH, repo_id, REPO_META)
    with open(repo_meta_path, "w", encoding="utf-8") as f:
        f.write(repo_meta.model_dump_json(indent=2))

    return


@router.post("/{repo_id}/checkout", response_model=RepoTreeInfo, operation_id="checkoutRepoRef")
def checkout_repo_ref(
    repo_id: str,
    ref: str,
    user: User = Depends(require_developer),
):
    """Checkout a specific ref in the staging repo"""
    repo_path = get_user_worktree_path(repo_id, user)
    ensure_clean(repo_path)
    run_git(["checkout", ref], cwd=repo_path)
    return get_staging_repo_tree(repo_id, user)


@router.get("/{repo_id}/tree", response_model=RepoTreeInfo, operation_id="getStagingRepoTree")
def get_staging_repo_tree(
    repo_id: str,
    user: User = Depends(require_developer),
):
    repo_path = get_user_worktree_path(repo_id, user)
    tree = build_path_tree(repo_path)
    _, repo_meta = get_repo_meta(repo_id)
    working_tree_status = get_working_tree_status(repo_path)
    return RepoTreeInfo(
        **repo_meta.model_dump(),
        refs=list_repository_refs(repo_id, user),
        checked_out_ref=get_checked_out_ref(repo_id, user),
        tree=tree,
        working_tree_status=working_tree_status,
    )
