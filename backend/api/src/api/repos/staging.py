# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import os
import uuid
import subprocess
import json
import base64
import shutil
import httpx
from urllib.parse import urlparse
from .common import REPOS_BASE_PATH, BARE_CLONE_NAME
from fastapi import APIRouter, HTTPException, Body, Query, Depends, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Tuple, Literal
from datetime import datetime, timezone
from api.auth.roles import require_developer, User
from api.repos.common import (
    FileResponse,
    StagingMeta,
    TreeNode,
    get_repo_meta,
    build_path_tree,
    list_all_repositories,
    DEPLOYMENTS_REL_FOLDER,
    WORKTREES_REL_FOLDER,
    CURRENT_SYMLINK,
    REPO_META,
    NEW_FILE_CONTENT,
    ALLOWED_EXTENSIONS,
    OPI_EXTENSION,
)

router = APIRouter(
    prefix="/api/v1/repos/staging",
    tags=["[Admin] OPI management"],
    dependencies=[Depends(require_developer)],
)

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
TECHNICAL_ACCOUNT_TOKEN = os.getenv("TECHNICAL_ACCOUNT_TOKEN")
TECHNICAL_ACCOUNT_USERNAME = os.getenv("TECHNICAL_ACCOUNT_USERNAME", "weiss-bot")
TECHNICAL_ACCOUNT_EMAIL = os.getenv("TECHNICAL_ACCOUNT_EMAIL", "weiss-bot@dummy")
auth_cmd = None
if TECHNICAL_ACCOUNT_TOKEN:
    token = TECHNICAL_ACCOUNT_TOKEN.strip()
    auth_header = f"Authorization: Basic {base64.b64encode((TECHNICAL_ACCOUNT_USERNAME + ':' + token).encode()).decode()}"
    auth_cmd = ["-c", f"http.extraHeader={auth_header}"]
os.environ["GIT_ASKPASS"] = "echo"
os.environ["GIT_TERMINAL_PROMPT"] = "0"
os.environ["GIT_HTTP_USER_AGENT"] = "WEISS/1.0"
subprocess.run(
    ["git", "config", "--global", "user.name", TECHNICAL_ACCOUNT_USERNAME], check=True
)
subprocess.run(
    ["git", "config", "--global", "user.email", TECHNICAL_ACCOUNT_EMAIL], check=True
)


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RepoCreateRequest(BaseModel):
    alias: str = Field(..., description="Local OPI repository name")
    git_url: str = Field(..., description="Git repository URL")


class ValidationResult(BaseModel):
    valid: bool
    errors: List[str] = []


class DeployRequest(BaseModel):
    deployment_version: str  # tag or commit hash to deploy


class FileUpdateRequest(BaseModel):
    content: str = Field(..., description="Full file content to write")


class CommitRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Git commit message")
    tag: str | None = Field(None, description="Optional Git tag to add after commit")


class PathCreateRequest(BaseModel):
    path: str = Field(..., description="Path to create, relative to repo root")
    type: str = Field(
        ...,
        description="Type of path to create: 'file' or 'directory'.",
        pattern="^(file|directory)$",
    )


class PathRenameRequest(BaseModel):
    new_name: str = Field(
        ...,
        description="New name for the file or directory (just the name segment, not the full path)",
    )


class PathMoveRequest(BaseModel):
    destination: str = Field(
        ...,
        description="Destination directory path, relative to repo root. The item is moved into this directory.",
    )


class GitFileStatus(BaseModel):
    path: str
    status: Literal["modified", "added", "deleted", "renamed", "untracked"]


class GitWorkingTreeStatus(BaseModel):
    dirty: bool
    files: List[GitFileStatus]


class TokenStatus(BaseModel):
    configured: bool
    valid: bool
    detail: str


class RepoRef(BaseModel):
    ref: str
    message: str


class StagingTreeInfo(StagingMeta):
    refs: List[RepoRef]
    checked_out_ref: str
    tree: List[TreeNode]
    working_tree_status: GitWorkingTreeStatus


# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
_COMPOUND_EXTENSIONS = (".opi.json",)


def get_file_ext(filename: str) -> str:
    """Return the effective extension, treating compound extensions (e.g. .opi.json) as one unit."""
    lower = filename.lower()
    for ext in _COMPOUND_EXTENSIONS:
        if lower.endswith(ext):
            return ext
    _, ext = os.path.splitext(filename)
    return ext.lower()


def run_git(cmd: list[str], cwd: str | None = None, allow_fail: bool = False) -> str:
    """Run git command and raise exception if allow_fail==False (default)"""
    try:
        if auth_cmd:
            result = subprocess.run(
                ["git"] + auth_cmd + cmd,
                cwd=cwd,
                check=True,
                capture_output=True,
                text=True,
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


def get_default_branch(repo_path: str) -> str:
    # Try the remote-tracking HEAD first (local)
    ref = run_git(
        ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
        cwd=repo_path,
        allow_fail=True,
    )
    if ref:
        return ref.removeprefix("origin/")
    # Fall back to the local HEAD symbolic ref (bare repos right after clone)
    ref = run_git(["symbolic-ref", "--short", "HEAD"], cwd=repo_path, allow_fail=True)
    return ref if ref else "main"


def clone(git_url: str, repo_id: str) -> str:
    if any(r.git_url == git_url for r in list_all_repositories()):
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
            files.append(GitFileStatus(path=path, status="untracked"))
        elif "R" in code:
            # if porcelain returns rename as "old -> new", report old path as
            # deleted and new as renamed. The difference doesn't matter for FE
            parts = path.split(" -> ", 1)
            if len(parts) == 2:
                files.append(GitFileStatus(path=parts[0], status="deleted"))
                files.append(GitFileStatus(path=parts[1], status="renamed"))
            else:
                files.append(GitFileStatus(path=path, status="renamed"))
        elif "D" in code:
            files.append(GitFileStatus(path=path, status="deleted"))
        elif "A" in code:
            files.append(GitFileStatus(path=path, status="added"))
        else:
            files.append(GitFileStatus(path=path, status="modified"))

    return GitWorkingTreeStatus(
        dirty=bool(files),
        files=files,
    )


def get_checked_out_ref(repo_id: str, user: User):
    repo_path = get_user_worktree_path(repo_id, user)
    repo_head = run_git(["rev-parse", "HEAD"], cwd=repo_path).strip()
    tag = run_git(
        ["describe", "--tags", "--exact-match", repo_head],
        cwd=repo_path,
        allow_fail=True,
    ).strip()
    return tag if tag else repo_head


def create_snapshot(repo_id: str, ref: str, user: User) -> Tuple[str, str]:
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

    result = validate_repo_content(deployment_path)
    if not result.valid:
        shutil.rmtree(deployment_path, ignore_errors=True)
        raise HTTPException(
            status_code=422,
            detail=f"Repository validation failed: {'; '.join(result.errors)}",
        )

    return deployment_id, deployment_path


def validate_repo_content(repo_path: str) -> ValidationResult:
    """Validate that all .opi.json files in the repo parse as valid JSON."""
    errors: list[str] = []
    for dirpath, dirnames, filenames in os.walk(repo_path):
        # Skip hidden dirs (e.g. .git)
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for filename in filenames:
            if not filename.endswith(OPI_EXTENSION):
                continue
            if filename in {REPO_META}:
                continue
            full = os.path.join(dirpath, filename)
            rel = os.path.relpath(full, repo_path)
            try:
                with open(full, "r", encoding="utf-8") as f:
                    json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                errors.append(f"{rel}: {e}")
    return ValidationResult(valid=not errors, errors=errors)


def _check_token(git_url: str) -> TokenStatus:
    """Core token validation logic against the hosting platform's auth API."""
    if not TECHNICAL_ACCOUNT_TOKEN:
        return TokenStatus(configured=False, valid=False, detail="No token configured")

    token = TECHNICAL_ACCOUNT_TOKEN.strip()
    hostname = urlparse(git_url).hostname or ""

    try:
        if "github.com" in hostname:
            resp = httpx.get(
                "https://api.github.com/user",
                headers={"Authorization": f"token {token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return TokenStatus(configured=True, valid=True, detail="Token is valid")
            return TokenStatus(
                configured=True, valid=False, detail="Token authentication failed"
            )

        if "gitlab" in hostname:
            base = f"https://{hostname}"
            resp = httpx.get(
                f"{base}/api/v4/user",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return TokenStatus(configured=True, valid=True, detail="Token is valid")
            return TokenStatus(
                configured=True, valid=False, detail="Token authentication failed"
            )

        # Unknown platform — fall back to git ls-remote (best-effort; public repos
        # won't distinguish a bad token from a good one here).
        result = subprocess.run(
            ["git"] + (auth_cmd or []) + ["ls-remote", git_url],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            return TokenStatus(
                configured=True,
                valid=True,
                detail="Token configured; platform unknown, remote reachable",
            )
        stderr = result.stderr.lower()
        if (
            "authentication" in stderr
            or "403" in stderr
            or "401" in stderr
            or "could not read" in stderr
        ):
            return TokenStatus(
                configured=True, valid=False, detail="Token authentication failed"
            )
        return TokenStatus(
            configured=True,
            valid=True,
            detail=f"Token configured; remote check inconclusive: {result.stderr.strip()}",
        )

    except httpx.TimeoutException:
        return TokenStatus(
            configured=True, valid=True, detail="Token configured; API check timed out"
        )
    except subprocess.TimeoutExpired:
        return TokenStatus(
            configured=True,
            valid=True,
            detail="Token configured; remote check timed out",
        )


def _require_valid_token(git_url: str) -> None:
    """Raise HTTP 503 if the PAT token is not configured or fails authentication."""
    status = _check_token(git_url)
    if not status.valid:
        raise HTTPException(
            status_code=503,
            detail=f"Remote operation unavailable: {status.detail}",
        )


@router.get("/token-status", response_model=TokenStatus, operation_id="getTokenStatus")
def get_token_status():
    """Return whether the configured PAT technical-account token is able to
    authenticate against the remote hosting platform's API.
    """
    repos = list_all_repositories()
    if not repos:
        if not TECHNICAL_ACCOUNT_TOKEN:
            return TokenStatus(
                configured=False, valid=False, detail="No token configured"
            )
        return TokenStatus(
            configured=True,
            valid=True,
            detail="Token configured; no repositories registered to verify against",
        )
    return _check_token(repos[0].git_url)


@router.get("/", response_model=List[StagingMeta], operation_id="listRepos")
def list_repositories():
    return list_all_repositories()


@router.get(
    "/tree", response_model=List[StagingTreeInfo], operation_id="getAllReposTree"
)
def get_all_repos_tree(user: User = Depends(require_developer)):
    all_trees = []
    for repo in list_all_repositories():
        repo_path = get_user_worktree_path(repo.id, user)
        tree = build_path_tree(repo_path)
        wts = get_working_tree_status(repo_path)
        current_checkout = get_checked_out_ref(repo.id, user)
        all_trees.append(
            StagingTreeInfo(
                **repo.model_dump(),
                refs=list_repository_refs(repo.id, user),
                checked_out_ref=current_checkout,
                tree=tree,
                working_tree_status=wts,
            )
        )
    return all_trees


@router.post(
    "/register", response_model=List[StagingTreeInfo], operation_id="registerRepo"
)
def register_repository(
    payload: RepoCreateRequest, user: User = Depends(require_developer)
):
    """Register a Git repository and create a clone"""
    repo_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    clone(payload.git_url, repo_id)

    repo_meta = StagingMeta(
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
    "/{repo_id}/unregister",
    response_model=List[StagingTreeInfo],
    operation_id="unregisterRepo",
)
def unregister_repository(repo_id: str, user: User = Depends(require_developer)):
    """
    Remove a repository completely:
    - Delete staging folder
    - Delete all deployments
    - Remove repo metadata
    """
    repo_base = os.path.join(REPOS_BASE_PATH, repo_id)
    repo_meta_path = os.path.join(repo_base, REPO_META)

    if not os.path.exists(repo_meta_path):
        raise HTTPException(status_code=404, detail="Repository not found")

    # Remove repository folder
    try:
        if os.path.exists(repo_base):
            import shutil

            shutil.rmtree(repo_base)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete repository: {str(e)}"
        )
    # TODO: store all repos tree and edit in place instead of recalculating
    return get_all_repos_tree(user)


@router.get(
    "/{repo_id}/refs", response_model=list[RepoRef], operation_id="listRepoRefs"
)
def list_repository_refs(
    repo_id: str, user: User = Depends(require_developer)
) -> list[RepoRef]:
    """List 20 latest repository refs available. Assumes repo is up to date.
    If commit is tagged, show tag instead of SHA.
    """
    repo_path = get_user_worktree_path(repo_id, user)
    default_branch = get_default_branch(repo_path)
    log_lines = run_git(
        ["log", "--pretty=format:%H|||%s", "--max-count=20", default_branch],
        cwd=repo_path,
    ).splitlines()

    tag_refs = run_git(
        ["show-ref", "--tags"], cwd=repo_path, allow_fail=True
    ).splitlines()
    commit_to_tag = {}
    for line in tag_refs:
        sha, ref = line.split()
        tag = ref.replace("refs/tags/", "")
        commit_to_tag[sha] = tag

    refs: list[RepoRef] = []
    for entry in log_lines:
        sha, _, message = entry.partition("|||")
        ref = commit_to_tag.get(sha, sha)
        refs.append(RepoRef(ref=ref, message=message))

    return refs


@router.post("/{repo_id}/sync", response_model=StagingTreeInfo, operation_id="syncRepo")
def update_repo(repo_id: str, user: User = Depends(require_developer)):
    """Fetch new tags/commits from default branch and rebase current worktree onto it."""
    repo_path = get_user_worktree_path(repo_id, user)
    bare_repo = os.path.join(REPOS_BASE_PATH, repo_id, BARE_CLONE_NAME)
    default_branch = get_default_branch(bare_repo)
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


@router.get(
    "/{repo_id}/file", response_model=FileResponse, operation_id="getStagingRepoFile"
)
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

    _, ext = os.path.splitext(path)
    if ext.lower() in {".png", ".jpg", ".jpeg"}:
        with open(full_path, "rb") as f:
            content = base64.b64encode(f.read()).decode("ascii")
        return FileResponse(path=path, content=content, encoding="base64")

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    return FileResponse(path=path, content=content)


@router.post(
    "/{repo_id}/upload",
    response_model=StagingTreeInfo,
    operation_id="uploadStagingRepoFile",
)
async def upload_staging_repo_file(
    repo_id: str,
    path: str = Query(
        ...,
        description="Destination path for the file, relative to repo root (e.g. images/logo.png)",
    ),
    file: UploadFile = File(...),
    user: User = Depends(require_developer),
):
    """
    Upload a file to the staging repository.
    Creates or overwrites the file at the given path.
    Intermediate directories are created as needed.
    """
    rel_path = os.path.normpath(path).lstrip(os.sep)
    if rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid file path")

    rel_lower = rel_path.lower()
    _, ext = os.path.splitext(rel_lower)
    if not rel_lower.endswith(OPI_EXTENSION) and ext not in ALLOWED_EXTENSIONS:
        allowed_str = ", ".join(sorted([OPI_EXTENSION] + list(ALLOWED_EXTENSIONS)))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {allowed_str}",
        )

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB",
        )

    repo_path = get_user_worktree_path(repo_id, user)
    full_path = os.path.join(repo_path, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    try:
        with open(full_path, "wb") as f:
            f.write(contents)
        run_git(["add", rel_path], cwd=repo_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

    return get_staging_repo_tree(repo_id, user)


@router.put(
    "/{repo_id}/file",
    operation_id="updateStagingRepoFile",
    response_model=StagingTreeInfo,
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
    response_model=StagingTreeInfo,
    operation_id="resetStagingRepoFile",
)
def reset_staging_repo_file(
    repo_id: str,
    path: str = Query(
        ..., description="Path to file inside repository (relative to root)"
    ),
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
    response_model=StagingTreeInfo,
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
    response_model=StagingTreeInfo,
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

    # Compute the final target path before checking existence
    if payload.type == "file" and not rel_path.endswith(OPI_EXTENSION):
        final_path = full_path + OPI_EXTENSION
    else:
        final_path = full_path

    if os.path.exists(final_path):
        raise HTTPException(status_code=400, detail="File or directory already exists")

    try:
        os.makedirs(parent_dir, exist_ok=True)

        if payload.type == "file":
            with open(final_path, "w", encoding="utf-8") as f:
                json.dump(NEW_FILE_CONTENT, f, indent=2)
                f.write("\n")
            run_git(["add", final_path], cwd=repo_path)
        elif payload.type == "directory":
            # Create directory and .gitkeep
            os.makedirs(final_path, exist_ok=True)
            gitkeep = os.path.join(final_path, ".gitkeep")
            with open(gitkeep, "w"):
                pass
            run_git(["add", final_path], cwd=repo_path)
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create {payload.type}: {str(e)}"
        )

    return get_staging_repo_tree(repo_id, user)


@router.delete(
    "/{repo_id}/path",
    response_model=StagingTreeInfo,
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
        shutil.rmtree(full_path)
    else:
        os.remove(full_path)

    run_git(["add", "-A"], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/path/rename",
    response_model=StagingTreeInfo,
    operation_id="renameStagingRepoPath",
)
def rename_staging_repo_path(
    repo_id: str,
    path: str = Query(
        ...,
        description="File or directory path inside repository, relative to root.",
    ),
    payload: PathRenameRequest = Body(...),
    user: User = Depends(require_developer),
):
    """
    Rename a file or directory in the staging repository.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    rel_path = os.path.normpath(path).lstrip(os.sep)
    if rel_path.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid path")

    new_name = payload.new_name.strip()
    if not new_name or os.sep in new_name or "/" in new_name:
        raise HTTPException(
            status_code=400,
            detail="new_name must be a single name without path separators",
        )

    full_path = os.path.join(repo_path, rel_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Path not found")

    if os.path.isfile(full_path):
        old_filename = os.path.basename(rel_path)
        old_ext = get_file_ext(old_filename)
        new_ext = get_file_ext(new_name)
        if old_ext != new_ext:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change file extension (expected '{old_ext}')",
            )

    parent_rel = os.path.dirname(rel_path)
    new_rel_path = os.path.join(parent_rel, new_name) if parent_rel else new_name
    new_full_path = os.path.join(repo_path, new_rel_path)
    if os.path.exists(new_full_path):
        raise HTTPException(
            status_code=400, detail="A file or directory with that name already exists"
        )

    run_git(["mv", rel_path, new_rel_path], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/path/move",
    response_model=StagingTreeInfo,
    operation_id="moveStagingRepoPath",
)
def move_staging_repo_path(
    repo_id: str,
    path: str = Query(
        ...,
        description="File or directory path to move, relative to repo root.",
    ),
    payload: PathMoveRequest = Body(...),
    user: User = Depends(require_developer),
):
    """
    Move a file or directory to a different directory in the staging repository.
    The item keeps its name; only its parent directory changes.
    The destination must be an existing directory.
    """
    repo_path = get_user_worktree_path(repo_id, user)

    # Normalise and validate source
    rel_src = os.path.normpath(path).lstrip(os.sep)
    if rel_src.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid source path")

    # Normalise and validate destination
    rel_dst_dir = os.path.normpath(payload.destination).lstrip(os.sep)
    if rel_dst_dir.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid destination path")

    full_src = os.path.join(repo_path, rel_src)
    if not os.path.exists(full_src):
        raise HTTPException(status_code=404, detail="Source path not found")

    full_dst_dir = os.path.join(repo_path, rel_dst_dir)
    if not os.path.isdir(full_dst_dir):
        raise HTTPException(
            status_code=400, detail="Destination must be an existing directory"
        )

    item_name = os.path.basename(rel_src)
    rel_dst = os.path.join(rel_dst_dir, item_name)

    if rel_src == rel_dst:
        raise HTTPException(
            status_code=400, detail="Source and destination are the same"
        )

    if os.path.exists(os.path.join(repo_path, rel_dst)):
        raise HTTPException(
            status_code=400,
            detail="A file or directory with that name already exists in the destination",
        )

    # Prevent moving a directory into one of its own descendants
    if os.path.isdir(full_src) and rel_dst.startswith(rel_src + os.sep):
        raise HTTPException(
            status_code=400,
            detail="Cannot move a directory into one of its own subdirectories",
        )

    full_dst = os.path.join(repo_path, rel_dst)
    shutil.move(full_src, full_dst)
    run_git(["add", "-A"], cwd=repo_path)

    return get_staging_repo_tree(repo_id, user)


@router.post(
    "/{repo_id}/commit",
    response_model=StagingTreeInfo,
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
    _, repo_meta = get_repo_meta(repo_id)
    _require_valid_token(repo_meta.git_url)
    repo_path = get_user_worktree_path(repo_id, user)
    bare_repo = os.path.join(REPOS_BASE_PATH, repo_id, BARE_CLONE_NAME)

    # Ensure there is something staged
    staged = run_git(["diff", "--cached", "--name-only"], cwd=repo_path)
    if not staged.strip():
        raise HTTPException(status_code=400, detail="No staged changes to commit")

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
        default_branch = get_default_branch(bare_repo)
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


@router.post("/{repo_id}/deploy", response_model=StagingMeta, operation_id="deployRepo")
def deploy_repo(
    repo_id: str, payload: DeployRequest, user: User = Depends(require_developer)
):
    """Deploy a selected tag or commit to make it available for users"""
    ref_to_deploy = payload.deployment_version
    try:
        deployment_id, snapshot_path = create_snapshot(repo_id, ref_to_deploy, user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create snapshot: {str(e)}"
        )
    repo_meta_path, repo_meta = get_repo_meta(repo_id)
    repo_meta.current_deployment = deployment_id
    repo_meta.deployed_ref = ref_to_deploy
    repo_meta.deployed_at = datetime.now(timezone.utc).isoformat()

    with open(repo_meta_path, "w") as f:
        f.write(repo_meta.model_dump_json(indent=2))
    current_link = os.path.join(
        REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK
    )
    if os.path.islink(current_link) or os.path.exists(current_link):
        os.remove(current_link)
    os.symlink(snapshot_path, current_link)
    return StagingMeta(**repo_meta.model_dump())


@router.post("/{repo_id}/undeploy", operation_id="undeployRepo")
def undeploy_repository(repo_id: str):
    """
    Remove the current deployment for a repository:
    - Delete symlink to current deployment
    - Clear current deployment metadata in repo info
    """
    repo_meta_path, repo_meta = get_repo_meta(repo_id)
    current_link = os.path.join(
        REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK
    )

    if os.path.islink(current_link) or os.path.exists(current_link):
        try:
            os.remove(current_link)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to remove current deployment link: {str(e)}",
            )

    # Clear deployment info
    repo_meta.current_deployment = None
    repo_meta.deployed_ref = None
    repo_meta.deployed_at = None
    with open(repo_meta_path, "w", encoding="utf-8") as f:
        f.write(repo_meta.model_dump_json(indent=2))

    return


@router.post(
    "/{repo_id}/checkout",
    response_model=StagingTreeInfo,
    operation_id="checkoutRepoRef",
)
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


@router.get(
    "/{repo_id}/tree", response_model=StagingTreeInfo, operation_id="getStagingRepoTree"
)
def get_staging_repo_tree(
    repo_id: str,
    user: User = Depends(require_developer),
):
    repo_path = get_user_worktree_path(repo_id, user)
    tree = build_path_tree(repo_path)
    _, repo_meta = get_repo_meta(repo_id)
    working_tree_status = get_working_tree_status(repo_path)
    return StagingTreeInfo(
        **repo_meta.model_dump(),
        refs=list_repository_refs(repo_id, user),
        checked_out_ref=get_checked_out_ref(repo_id, user),
        tree=tree,
        working_tree_status=working_tree_status,
    )
