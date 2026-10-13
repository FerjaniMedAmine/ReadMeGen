"""Exercise an installed wheel's GUI, asset URLs, and graceful shutdown."""

import os
import re
import tempfile

import httpx

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.web.server import launch_ui


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="readmegen-smoke-") as directory:
        os.environ["READMEGEN_HOME"] = directory
        credentials = CredentialStore()
        handle = launch_ui(credentials, ChatGPTAuth(credentials), port=0, open_browser=False)
        try:
            response = httpx.get(handle.url)
            response.raise_for_status()
            assert "ReadMeGen" in response.text
            for url in re.findall(r'(?:src|href)="(/[^\"]+)"', response.text):
                httpx.get(handle.url + url).raise_for_status()
            assert httpx.get(handle.url + "/api/v1/health").json()["app"] == "readmegen"
        finally:
            handle.stop()
        assert not handle.thread.is_alive()
        print("Installed GUI served its HTML, assets, and API, then shut down cleanly.")


if __name__ == "__main__":
    main()
