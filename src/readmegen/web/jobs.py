"""Persistent local job status; one active generation per desktop server."""

import asyncio
import json
import sqlite3
import time
from pathlib import Path
from uuid import uuid4

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.config import Settings
from readmegen.errors import ReadMeGenError
from readmegen.service import generate
from readmegen.storage import write_text

RETENTION_SECONDS = 7 * 24 * 60 * 60


class JobStore:
    def __init__(self, directory: Path):
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.database = directory / "jobs.sqlite3"
        with self._connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, updated REAL NOT NULL, status TEXT NOT NULL)"
            )
            connection.execute(
                "UPDATE jobs SET status = ? WHERE json_extract(status, '$.status') NOT IN ('ready', 'error')",
                (
                    json.dumps(
                        {
                            "status": "error",
                            "detail": "The application stopped before this job finished. Try again.",
                        }
                    ),
                ),
            )
            rows = connection.execute(
                "SELECT id FROM jobs WHERE updated < ?", (time.time() - RETENTION_SECONDS,)
            ).fetchall()
        for (job_id,) in rows:
            self.delete(job_id)
        # A force-quit can bypass the runner's upload cleanup.
        for upload in directory.glob("*/upload.zip"):
            upload.unlink(missing_ok=True)

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database, timeout=10)

    def create(self) -> str:
        job_id = uuid4().hex
        (self.directory / job_id).mkdir(mode=0o700)
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO jobs VALUES (?, ?, ?)",
                (job_id, time.time(), json.dumps({"status": "extracting"})),
            )
        return job_id

    def get(self, job_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute("SELECT status FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def update(self, job_id: str, phase: str, **extra) -> None:
        state = {**(self.get(job_id) or {}), "status": phase, **extra}
        with self._connect() as connection:
            connection.execute(
                "UPDATE jobs SET status = ?, updated = ? WHERE id = ?",
                (json.dumps(state), time.time(), job_id),
            )

    def delete(self, job_id: str) -> None:
        import shutil

        with self._connect() as connection:
            connection.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        shutil.rmtree(self.directory / job_id, ignore_errors=True)


class JobRunner:
    def __init__(self, store: JobStore, credentials: CredentialStore, chatgpt: ChatGPTAuth):
        self.store = store
        self.credentials = credentials
        self.chatgpt = chatgpt
        self.tasks: set[asyncio.Task] = set()
        self.busy = False

    def start(
        self, job_id: str, source: str, settings: Settings, *, upload: Path | None = None
    ) -> None:
        task = asyncio.create_task(self._run(job_id, source, settings, upload))
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def _run(self, job_id: str, source: str, settings: Settings, upload: Path | None) -> None:
        try:
            result = await generate(
                source,
                settings,
                self.credentials,
                self.chatgpt,
                on_progress=lambda phase, **extra: self.store.update(job_id, phase, **extra),
            )
            write_text(self.store.directory / job_id / "README.md", result)
            self.store.update(job_id, "ready")
        except asyncio.CancelledError:
            self.store.update(job_id, "error", detail="Generation was stopped. Try again.")
            raise
        except ReadMeGenError as error:
            self.store.update(job_id, "error", detail=str(error))
        except Exception:
            self.store.update(job_id, "error", detail="Generation failed unexpectedly. Try again.")
        finally:
            if upload:
                upload.unlink(missing_ok=True)
            self.busy = False

    async def close(self) -> None:
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
