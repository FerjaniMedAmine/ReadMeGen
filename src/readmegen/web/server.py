"""Start one local server, announce readiness, and own its shutdown lifecycle."""

import socket
import threading
import time
import webbrowser
from contextlib import suppress
from dataclasses import dataclass

from filelock import FileLock, Timeout

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.config import cache_dir
from readmegen.errors import ConfigurationError


@dataclass
class UIHandle:
    url: str
    server: object
    thread: threading.Thread

    def stop(self) -> None:
        self.server.should_exit = True
        self.thread.join(timeout=15)


def launch_ui(
    credentials: CredentialStore,
    chatgpt: ChatGPTAuth,
    *,
    port: int = 8765,
    open_browser: bool = True,
) -> UIHandle:
    try:
        import uvicorn

        from readmegen.web.app import STATIC_DIR, create_app
    except ModuleNotFoundError as error:
        raise ConfigurationError(
            "Install GUI dependencies with: pip install 'readmegen-agent[web]'"
        ) from error
    if not (STATIC_DIR / "index.html").is_file():
        raise ConfigurationError(
            "The GUI build is missing. From a source checkout, run: python scripts/build_frontend.py"
        )
    directory = cache_dir()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = FileLock(str(directory / "ui.lock"), thread_local=False)
    try:
        lock.acquire(timeout=0)
    except Timeout as error:
        raise ConfigurationError(
            "ReadMeGen's local UI is already running. Use the address printed in its terminal."
        ) from error
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError as error:
            if port != 8765:
                raise ConfigurationError(
                    f"Port {port} is unavailable. Choose another port or use --port 0."
                ) from error
            sock.bind(("127.0.0.1", 0))
        sock.listen(128)
        url = f"http://127.0.0.1:{sock.getsockname()[1]}"
        server = uvicorn.Server(
            uvicorn.Config(
                create_app(credentials=credentials, chatgpt=chatgpt),
                host="127.0.0.1",
                port=sock.getsockname()[1],
                log_level="warning",
                access_log=False,
                timeout_graceful_shutdown=5,
                proxy_headers=False,
            )
        )

        def run() -> None:
            try:
                server.run(sockets=[sock])
            finally:
                sock.close()
                lock.release()

        thread = threading.Thread(target=run, name="readmegen-ui", daemon=True)
        thread.start()
        deadline = time.monotonic() + 15
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.05)
        if not server.started:
            server.should_exit = True
            thread.join(timeout=5)
            raise ConfigurationError("The local interface could not start.")
        if open_browser:
            with suppress(webbrowser.Error):
                webbrowser.open(url)
        return UIHandle(url, server, thread)
    except BaseException:
        sock.close()
        lock.release()
        raise
