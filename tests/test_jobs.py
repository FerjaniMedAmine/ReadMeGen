import sqlite3
import time

from readmegen.web.jobs import JobStore


def test_restart_preserves_ready_results_and_marks_interrupted_jobs(tmp_path):
    store = JobStore(tmp_path / "jobs")
    interrupted = store.create()
    completed = store.create()
    store.update(completed, "ready", file_count=3)
    upload = store.directory / interrupted / "upload.zip"
    upload.write_bytes(b"private source")
    restarted = JobStore(store.directory)
    assert restarted.get(completed) == {"status": "ready", "file_count": 3}
    assert restarted.get(interrupted)["status"] == "error"
    assert not upload.exists()


def test_expired_job_cleanup_does_not_deadlock_sqlite(tmp_path):
    store = JobStore(tmp_path / "jobs")
    job = store.create()
    with sqlite3.connect(store.database) as connection:
        connection.execute(
            "UPDATE jobs SET updated = ? WHERE id = ?", (time.time() - 8 * 86400, job)
        )
    restarted = JobStore(store.directory)
    assert restarted.get(job) is None
    assert not (store.directory / job).exists()
