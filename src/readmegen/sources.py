"""Framework-independent local, ZIP, and public Git ingestion."""

import asyncio
import os
import shutil
import signal
import stat
import tempfile
import zipfile
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

from readmegen.concurrency import run_blocking
from readmegen.errors import ImportError
from readmegen.generation.limits import (
    EXCLUDE_DIRS,
    EXCLUDE_EXTENSIONS,
    KEEP_HIDDEN_FILES,
    MAX_FILE_SIZE_BYTES,
    MAX_TOTAL_FILES,
)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_EXTRACTED_BYTES = 300 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 10_000
MAX_SCAN_ENTRIES = 30_000
ALLOWED_GIT_HOSTS = {"github.com", "gitlab.com", "bitbucket.org"}
SECRET_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".jks"}
SECRET_NAMES = {"credentials.json", "secrets.json", "service-account.json", "id_rsa", "id_ed25519"}


@dataclass(frozen=True)
class FilteredFile:
    path: Path
    relative_path: str
    size_bytes: int


def excluded(path: PurePosixPath) -> bool:
    if any(part in EXCLUDE_DIRS for part in path.parts[:-1]):
        return True
    name = path.name.lower()
    return (
        (name.startswith(".") and name not in KEEP_HIDDEN_FILES)
        or path.suffix.lower() in EXCLUDE_EXTENSIONS | SECRET_SUFFIXES
        or name in SECRET_NAMES
        or name.endswith((".min.js", ".min.css"))
        or name.startswith((".env", "credentials.", "secrets."))
        and name != ".env.example"
    )


def filter_project_files(source: Path) -> list[FilteredFile]:
    root = source.resolve()
    if not root.is_dir():
        raise ImportError("The project directory does not exist.")
    files: list[FilteredFile] = []
    scanned = 0
    for directory, folders, names in os.walk(root, followlinks=False):
        folders[:] = sorted(
            name
            for name in folders
            if name not in EXCLUDE_DIRS and not (Path(directory) / name).is_symlink()
        )
        for name in sorted(names):
            scanned += 1
            if scanned > MAX_SCAN_ENTRIES:
                raise ImportError("The project has too many entries to scan safely.")
            path = Path(directory) / name
            relative = path.relative_to(root).as_posix()
            if path.is_symlink() or excluded(PurePosixPath(relative)):
                continue
            try:
                info = path.stat()
                if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= MAX_FILE_SIZE_BYTES:
                    continue
                with path.open("rb") as stream:
                    if b"\0" in stream.read(8192):
                        continue
            except OSError:
                continue
            files.append(FilteredFile(path, relative, info.st_size))
            if len(files) > MAX_TOTAL_FILES:
                raise ImportError(f"The project exceeds the {MAX_TOTAL_FILES} readable-file limit.")
    return files


def extract_zip(archive_path: Path, target: Path) -> None:
    if archive_path.stat().st_size > MAX_UPLOAD_BYTES:
        raise ImportError("ZIP archives must be at most 50 MB.")
    try:
        with zipfile.ZipFile(archive_path) as archive:
            members = archive.infolist()
            if len(members) > MAX_ARCHIVE_ENTRIES:
                raise ImportError("The archive contains too many entries.")
            selected: list[tuple[zipfile.ZipInfo, PurePosixPath]] = []
            seen: set[str] = set()
            total = 0
            for member in members:
                path = PurePosixPath(member.filename)
                if (
                    path.is_absolute()
                    or ".." in path.parts
                    or "\\" in member.filename
                    or any(":" in part for part in path.parts)
                    or stat.S_ISLNK(member.external_attr >> 16)
                    or member.flag_bits & 1
                ):
                    raise ImportError(
                        "The archive contains unsafe paths, links, or encrypted files."
                    )
                if member.is_dir() or excluded(path):
                    continue
                if not path.parts or path.as_posix().casefold() in seen:
                    raise ImportError("The archive contains duplicate or invalid paths.")
                seen.add(path.as_posix().casefold())
                total += member.file_size
                if total > MAX_EXTRACTED_BYTES:
                    raise ImportError("The archive exceeds the 300 MB extracted-size limit.")
                selected.append((member, path))
            if not selected:
                raise ImportError("This ZIP contains no readable project files.")
            target.mkdir(parents=True, exist_ok=False)
            actual_size = 0
            for member, path in selected:
                destination = target.joinpath(*path.parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, destination.open("xb") as output:
                    while chunk := source.read(1024 * 1024):
                        actual_size += len(chunk)
                        if actual_size > MAX_EXTRACTED_BYTES:
                            raise ImportError("The archive exceeds the extracted-size limit.")
                        output.write(chunk)
    except (zipfile.BadZipFile, OSError, RuntimeError, NotImplementedError) as error:
        raise ImportError("The ZIP is damaged or cannot be extracted.") from error


def validate_git_url(url: str) -> str:
    try:
        parsed = urlsplit(url.strip())
        valid = (
            parsed.scheme == "https"
            and parsed.hostname in ALLOWED_GIT_HOSTS
            and parsed.port in {None, 443}
            and not parsed.username
            and not parsed.password
            and not parsed.query
            and not parsed.fragment
            and len([part for part in parsed.path.split("/") if part]) >= 2
            and not any(ord(character) < 32 for character in url)
        )
    except ValueError:
        valid = False
    if not valid:
        raise ImportError("Use a public HTTPS repository URL from GitHub, GitLab, or Bitbucket.")
    return url.strip()


async def clone_git(url: str, target: Path) -> None:
    """Shallow clone without hooks, prompts, redirects, or repository-local config."""
    url = validate_git_url(url)
    environment = {
        **{key: value for key, value in os.environ.items() if not key.startswith("GIT_")},
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_LFS_SKIP_SMUDGE": "1",
        "GIT_ASKPASS": os.devnull,
    }
    command = [
        "git",
        "-c",
        "core.hooksPath=" + os.devnull,
        "-c",
        "credential.helper=",
        "-c",
        "http.followRedirects=false",
        "-c",
        "protocol.allow=never",
        "-c",
        "protocol.https.allow=always",
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--no-tags",
        "--no-recurse-submodules",
        "--",
        url,
        str(target),
    ]
    try:
        # Discard subprocess output: hosts can include credentials or untrusted text in errors.
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
            env=environment,
            start_new_session=os.name == "posix",
        )
    except FileNotFoundError as error:
        raise ImportError("Install Git to import a repository URL.") from error
    try:
        async with asyncio.timeout(120):
            while process.returncode is None:
                if target.exists():
                    await run_blocking(check_download_size, target)
                try:
                    await asyncio.wait_for(process.wait(), timeout=0.5)
                except TimeoutError:
                    continue
        if process.returncode:
            raise ImportError(
                "Git could not clone this public repository. Check its URL and connectivity."
            )
        await run_blocking(check_download_size, target)
    except TimeoutError as error:
        raise ImportError("Git import exceeded the 120-second timeout.") from error
    finally:
        if process.returncode is None:
            if os.name == "posix":
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
            await process.wait()
    shutil.rmtree(target / ".git", ignore_errors=True)


def check_download_size(target: Path) -> None:
    total = 0
    count = 0
    for path in target.rglob("*"):
        count += 1
        if count > MAX_SCAN_ENTRIES:
            raise ImportError("The repository contains too many entries.")
        if not path.is_symlink():
            try:
                total += path.lstat().st_size
            except FileNotFoundError:
                continue  # Git may rename temporary pack files during the scan.
        if total > MAX_EXTRACTED_BYTES:
            raise ImportError("The repository exceeds the 300 MB download limit.")


async def prepare_source(source: str, work: Path) -> Path:
    if source.startswith("https://"):
        target = work / "source"
        await clone_git(source, target)
        return target
    path = Path(source).expanduser().resolve()
    if path.is_dir():
        return path
    if path.is_file() and path.suffix.lower() == ".zip":
        target = work / "source"
        await run_blocking(extract_zip, path, target)
        return target
    raise ImportError("Provide a project directory, ZIP file, or public HTTPS Git URL.")


def temporary_workspace() -> tempfile.TemporaryDirectory:
    return tempfile.TemporaryDirectory(prefix="readmegen-")
