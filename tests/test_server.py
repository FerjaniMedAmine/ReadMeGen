import httpx
import pytest

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.errors import ConfigurationError
from readmegen.web.server import launch_ui


def test_launcher_serves_gui_and_releases_socket_and_singleton_lock(tmp_path, monkeypatch):
    assets = tmp_path / "static"
    assets.mkdir()
    (assets / "index.html").write_text("<html>ReadMeGen</html>")
    monkeypatch.setattr("readmegen.web.app.STATIC_DIR", assets)
    credentials = CredentialStore()
    auth = ChatGPTAuth(credentials)
    first = launch_ui(credentials, auth, port=0, open_browser=False)
    try:
        assert httpx.get(first.url + "/api/v1/health").json()["app"] == "readmegen"
        assert "ReadMeGen" in httpx.get(first.url).text
        with pytest.raises(ConfigurationError, match="already running"):
            launch_ui(credentials, auth, port=0, open_browser=False)
    finally:
        first.stop()
    assert not first.thread.is_alive()
    second = launch_ui(credentials, auth, port=0, open_browser=False)
    second.stop()
    assert not second.thread.is_alive()
