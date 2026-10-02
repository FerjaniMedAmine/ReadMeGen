import asyncio
import hashlib
import io
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks, HTTPException, UploadFile

from routers.ingestion import get_readme, project_status, upload_zip


def make_zip(files: dict[str, str]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    return output.getvalue()


class ZipImportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.projects = Path(self.temporary.name) / "projects"
        self.projects.mkdir()
        self.zip_path_patch = patch("services.zip_service.PROJECTS_DIR", self.projects)
        self.router_path_patch = patch("routers.ingestion.PROJECTS_DIR", self.projects)
        self.zip_path_patch.start()
        self.router_path_patch.start()

    def tearDown(self):
        self.router_path_patch.stop()
        self.zip_path_patch.stop()
        self.temporary.cleanup()

    async def upload(self, contents: bytes):
        uploaded_file = tempfile.SpooledTemporaryFile()
        uploaded_file.write(contents)
        uploaded_file.seek(0)
        tasks = BackgroundTasks()

        # Execute extraction inline in this test sandbox; production uses an executor.
        async def run_inline(executor, function, *args):
            return function(*args)

        loop = asyncio.get_running_loop()
        with patch.object(loop, "run_in_executor", side_effect=run_inline):
            result = await upload_zip(tasks, UploadFile(file=uploaded_file, filename="project.zip"))
            await tasks()
        return result

    async def test_archive_with_only_excluded_files_is_rejected_on_every_attempt(self):
        contents = make_zip({"node_modules/pkg/index.js": "generated"})
        project_dir = self.projects / hashlib.sha256(contents).hexdigest()

        for _ in range(2):
            with self.assertRaises(HTTPException) as error:
                await self.upload(contents)
            self.assertEqual(error.exception.status_code, 400)
            self.assertIn("no project files", error.exception.detail)
            self.assertFalse(project_dir.exists())

    async def test_retry_repairs_incomplete_directory_and_reuses_completed_import(self):
        contents = make_zip({"demo/package.json": '{"name":"demo"}'})
        project_id = hashlib.sha256(contents).hexdigest()
        (self.projects / project_id).mkdir()  # left by a previous failed import

        with patch("routers.ingestion.generate_readme", new=AsyncMock(return_value="# Demo\n")) as writer:
            first = await self.upload(contents)
            self.assertEqual(first["status"], "imported")
            self.assertEqual((await project_status(project_id))["status"], "ready")
            self.assertTrue((self.projects / project_id / "source" / "demo" / "package.json").is_file())

            second = await self.upload(contents)
            self.assertEqual(second["status"], "already_exists")
            self.assertEqual(await get_readme(project_id), "# Demo\n")
            self.assertEqual(writer.await_count, 1)


if __name__ == "__main__":
    unittest.main()
