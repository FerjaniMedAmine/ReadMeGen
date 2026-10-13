import io
import zipfile
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from readmegen.config import Settings, save_settings
from readmegen.web.app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch, credentials):
    save_settings(Settings(model="test-model"))
    monkeypatch.setattr("readmegen.web.app.build_model", lambda *_args: object())
    monkeypatch.setattr("readmegen.web.jobs.generate", AsyncMock(return_value="# Demo\n"))
    assets = tmp_path / "static"
    assets.mkdir()
    (assets / "index.html").write_text("<html>ReadMeGen</html>")
    app = create_app(credentials=credentials, data_dir=tmp_path / "jobs", static_dir=assets)
    with TestClient(app, base_url="http://127.0.0.1") as session:
        yield session


def test_ui_and_api_use_same_origin(client):
    assert "ReadMeGen" in client.get("/").text
    assert client.get("/api/v1/health").json()["app"] == "readmegen"
    assert "frame-ancestors 'none'" in client.get("/").headers["content-security-policy"]


def test_cross_site_requests_and_rebinding_hosts_are_rejected(client):
    assert (
        client.put(
            "/api/v1/connection",
            json={"provider": "openai"},
            headers={"Origin": "https://evil.test"},
        ).status_code
        == 403
    )
    assert (
        client.get("/api/v1/connection", headers={"Sec-Fetch-Site": "cross-site"}).status_code
        == 403
    )
    assert client.get("/api/v1/health", headers={"Host": "evil.test"}).status_code == 400


def test_validation_never_echoes_a_submitted_secret(client):
    secret = "submitted-secret"
    response = client.put("/api/v1/connection", json={"provider": "invalid", "api_key": secret})
    assert response.status_code == 422
    assert secret not in response.text


def test_session_key_is_not_returned_or_saved_in_preferences(client, tmp_path):
    response = client.put(
        "/api/v1/connection",
        json={
            "provider": "openai",
            "api_key": "private-test-key",
            "model": "test",
            "save_key": False,
        },
    )
    assert response.json()["connected"]
    assert "private-test-key" not in response.text
    from readmegen.config import config_dir

    assert "private-test-key" not in (config_dir() / "settings.json").read_text()


def test_git_job_completes_and_status_survives_runner(client):
    response = client.post(
        "/api/v1/projects/import-git", json={"git_url": "https://github.com/owner/repo"}
    )
    assert response.status_code == 202
    job_id = response.json()["project_id"]
    for _ in range(50):
        state = client.get(f"/api/v1/projects/{job_id}/status").json()
        if state["status"] == "ready":
            break
    assert state["status"] == "ready"
    assert client.get(f"/api/v1/projects/{job_id}/readme").text == "# Demo\n"


def test_upload_is_removed_after_generation(client):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("app.py", "print('hello')")
    response = client.post(
        "/api/v1/projects/upload-zip", files={"zip_file": ("project.zip", output.getvalue())}
    )
    assert response.status_code == 202
    job_id = response.json()["project_id"]
    for _ in range(50):
        if client.get(f"/api/v1/projects/{job_id}/status").json()["status"] == "ready":
            break
    assert not (client.app.state.jobs.directory / job_id / "upload.zip").exists()


def test_busy_server_rejects_more_imports(client):
    client.app.state.runner.busy = True
    response = client.post(
        "/api/v1/projects/import-git", json={"git_url": "https://github.com/owner/repo"}
    )
    assert response.status_code == 409
    client.app.state.runner.busy = False


def test_project_id_cannot_escape_cache(client):
    assert client.get("/api/v1/projects/invalid/status").status_code == 404
    assert client.get("/api/v1/projects/" + "a" * 32 + "/readme").status_code == 404
