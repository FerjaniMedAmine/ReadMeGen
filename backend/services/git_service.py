import hashlib
import ipaddress
import shutil
import socket
import subprocess
from asyncio import Lock
from collections import defaultdict
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import HTTPException

from core.config import PROJECTS_DIR

ALLOWED_GIT_HOSTS = {"github.com", "gitlab.com", "bitbucket.org"}
MAX_REPO_SIZE_BYTES = 200 * 1024 * 1024  # 200MB, adjust to your budget

# one lock per project_id, created on first use — prevents concurrent
# imports of the same repo from stepping on each other
_project_locks: dict[str, Lock] = defaultdict(Lock)


def get_project_id(git_url: str) -> str:
    normalized_url = git_url.strip().lower()
    return hashlib.sha256(normalized_url.encode("utf-8")).hexdigest()


def _validate_git_url(git_url: str) -> None:
    parsed = urlparse(git_url)

    if parsed.scheme != "https":
        raise HTTPException(
            status_code=400, detail="Seules les URLs Git HTTPS sont acceptées."
        )

    if parsed.hostname not in ALLOWED_GIT_HOSTS:
        raise HTTPException(
            status_code=400,
            detail=f"Hôte non autorisé. Hôtes acceptés : {', '.join(ALLOWED_GIT_HOSTS)}.",
        )

    # defense in depth: even an allowlisted hostname could resolve to
    # a private IP via DNS rebinding — check the resolved address too
    try:
        resolved_ip = ipaddress.ip_address(socket.gethostbyname(parsed.hostname))
    except (socket.gaierror, ValueError) as error:
        raise HTTPException(
            status_code=400, detail="Impossible de résoudre l'hôte Git."
        ) from error

    if resolved_ip.is_private or resolved_ip.is_loopback or resolved_ip.is_link_local:
        raise HTTPException(status_code=400, detail="URL Git non autorisée.")


def _check_clone_size(path) -> None:
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    if total > MAX_REPO_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Dépôt trop volumineux ({total / 1_048_576:.0f}MB, max {MAX_REPO_SIZE_BYTES / 1_048_576:.0f}MB).",
        )


async def import_git_project(git_url: str) -> dict:
    git_url = git_url.strip()
    _validate_git_url(git_url)

    project_id = get_project_id(git_url)
    project_directory = PROJECTS_DIR / project_id
    source_directory = project_directory / "source"
    temporary_directory = PROJECTS_DIR / f"git-temp-{uuid4().hex}"

    command = [
        "git",
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--no-tags",
        "--no-recurse-submodules",
        git_url,
        str(temporary_directory),
    ]

    # serialize imports of the same repo — a second request for the same
    # URL waits here instead of racing the first
    async with _project_locks[project_id]:
        try:
            # run_in_executor keeps this from blocking the event loop while
            # git clone runs — swap for asyncio.create_subprocess_exec if
            # you want to avoid the threadpool entirely
            import asyncio

            await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: subprocess.run(
                    command, check=True, capture_output=True, text=True, timeout=120
                ),
            )

            shutil.rmtree(temporary_directory / ".git", ignore_errors=True)
            _check_clone_size(temporary_directory)

            if project_directory.exists():
                shutil.rmtree(project_directory)

            project_directory.mkdir(parents=True, exist_ok=False)
            shutil.move(str(temporary_directory), str(source_directory))

        except FileNotFoundError as error:
            shutil.rmtree(temporary_directory, ignore_errors=True)
            raise HTTPException(
                status_code=500, detail="Git n'est pas installé ou accessible."
            ) from error

        except subprocess.TimeoutExpired as error:
            shutil.rmtree(temporary_directory, ignore_errors=True)
            raise HTTPException(
                status_code=408, detail="Le clonage Git a dépassé 120 secondes."
            ) from error

        except subprocess.CalledProcessError as error:
            shutil.rmtree(temporary_directory, ignore_errors=True)
            error_message = (
                error.stderr.strip() if error.stderr else "Le clonage Git a échoué."
            )
            raise HTTPException(status_code=400, detail=error_message) from error

        except Exception:
            shutil.rmtree(temporary_directory, ignore_errors=True)
            raise

    return {
        "project_id": project_id,
        "source_type": "git",
        "source_url": git_url,
        "status": "imported",
        "project_path": str(source_directory.relative_to(PROJECTS_DIR.parent)),
    }
