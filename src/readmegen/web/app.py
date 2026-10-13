"""Local-only HTTP interface over the same use case used by the CLI."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, SecretStr
from starlette.middleware.trustedhost import TrustedHostMiddleware

from readmegen import __version__
from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.config import Settings, cache_dir, load_settings, save_settings
from readmegen.errors import ReadMeGenError
from readmegen.providers import build_model, list_models
from readmegen.sources import MAX_UPLOAD_BYTES, validate_git_url
from readmegen.web.jobs import JobRunner, JobStore

STATIC_DIR = Path(__file__).parent / "static"


class ConnectionRequest(Settings):
    api_key: SecretStr | None = None
    save_key: bool = False


class LoginRequest(BaseModel):
    profile_id: str | None = None
    save_session: bool = True


class GitRequest(BaseModel):
    git_url: str = Field(max_length=2048)


def create_app(
    *,
    credentials: CredentialStore | None = None,
    chatgpt: ChatGPTAuth | None = None,
    data_dir: Path | None = None,
    static_dir: Path | None = None,
) -> FastAPI:
    credentials = credentials or CredentialStore()
    chatgpt = chatgpt or ChatGPTAuth(credentials)
    assets = static_dir or STATIC_DIR
    store = JobStore(data_dir or cache_dir() / "jobs")
    runner = JobRunner(store, credentials, chatgpt)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        await runner.close()
        chatgpt.close()

    app = FastAPI(
        title="ReadMeGen", version=__version__, lifespan=lifespan, docs_url=None, redoc_url=None
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])
    app.state.jobs = store
    app.state.runner = runner

    @app.middleware("http")
    async def local_requests(request: Request, call_next):
        if request.url.path.startswith("/api/"):
            origin = request.headers.get("origin")
            expected = urlsplit(str(request.base_url))
            if request.headers.get("sec-fetch-site") == "cross-site" or (
                origin
                and (urlsplit(origin).scheme, urlsplit(origin).netloc)
                != (expected.scheme, expected.netloc)
            ):
                return JSONResponse(
                    {"detail": "Requests must come from the local ReadMeGen interface."},
                    status_code=403,
                )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = (
            "no-store" if request.url.path.startswith("/api/") else "no-cache"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        return response

    @app.exception_handler(ReadMeGenError)
    async def application_error(_request: Request, error: ReadMeGenError):
        return JSONResponse({"detail": str(error)}, status_code=400)

    # Pydantic's standard errors include input values; redact submitted keys and URLs.
    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_request: Request, _error: RequestValidationError):
        return JSONResponse(
            {"detail": "Invalid request. Check the selected provider, model, and input fields."},
            status_code=422,
        )

    def check_idle() -> None:
        if runner.busy:
            raise HTTPException(409, "A generation is already running. Wait until it finishes.")

    def settings_response() -> dict:
        settings = load_settings()
        connected = False
        try:
            if settings.auth_mode == "chatgpt":
                connected = bool(
                    settings.profile_id and credentials.get(f"chatgpt:{settings.profile_id}")
                )
            else:
                connected = bool(credentials.api_key(settings.provider))
        except ReadMeGenError:
            pass
        return {**settings.model_dump(), "connected": connected, "profiles": chatgpt.profiles()}

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "app": "readmegen", "version": __version__}

    @app.get("/api/v1/connection")
    def connection():
        return settings_response()

    @app.put("/api/v1/connection")
    def configure(payload: ConnectionRequest):
        check_idle()
        settings = Settings.model_validate(payload.model_dump(exclude={"api_key", "save_key"}))
        if settings.auth_mode == "chatgpt" and settings.provider != "openai":
            raise HTTPException(400, "ChatGPT sign-in requires the OpenAI provider.")
        if payload.api_key:
            if settings.auth_mode != "api-key":
                raise HTTPException(400, "Choose API-key authentication before providing a key.")
            credentials.set(
                f"api-key:{settings.provider}",
                payload.api_key.get_secret_value(),
                persist=payload.save_key,
            )
        save_settings(settings)
        return settings_response()

    @app.get("/api/v1/models")
    async def models():
        return await list_models(load_settings(), credentials, chatgpt)

    @app.post("/api/v1/auth/chatgpt")
    def login(payload: LoginRequest):
        check_idle()
        pending = chatgpt.start(profile_id=payload.profile_id, persist=payload.save_session)
        return {"login_id": pending.id, "url": pending.url}

    @app.get("/api/v1/auth/chatgpt/{login_id}")
    def login_status(login_id: str):
        profile_id = chatgpt.finish(login_id)
        if not profile_id:
            return {"status": "waiting"}
        save_settings(Settings(auth_mode="chatgpt", provider="openai", profile_id=profile_id))
        return {"status": "connected", **settings_response()}

    @app.delete("/api/v1/auth/chatgpt/pending/{login_id}", status_code=204)
    def cancel_login(login_id: str):
        chatgpt.cancel(login_id)

    @app.delete("/api/v1/connection")
    def logout():
        check_idle()
        settings = load_settings()
        confirmed = True
        if settings.auth_mode == "chatgpt" and settings.profile_id:
            confirmed = chatgpt.logout(settings.profile_id)
        else:
            credentials.delete(f"api-key:{settings.provider}")
        return {"remote_revocation_confirmed": confirmed}

    def ready_settings() -> Settings:
        check_idle()
        settings = load_settings()
        build_model(settings, credentials, chatgpt)
        if settings.auth_mode == "chatgpt":
            # Fail before accepting/uploading source when the session is disconnected.
            chatgpt.access_token(settings.profile_id)
        return settings

    @app.post("/api/v1/projects/import-git", status_code=202)
    async def import_git(payload: GitRequest):
        settings = ready_settings()
        url = validate_git_url(payload.git_url)
        runner.busy = True
        job_id = store.create()
        runner.start(job_id, url, settings)
        return {"project_id": job_id}

    @app.post("/api/v1/projects/upload-zip", status_code=202)
    async def upload_zip(zip_file: Annotated[UploadFile, File()]):
        try:
            settings = ready_settings()
        except BaseException:
            await zip_file.close()
            raise
        if not (zip_file.filename or "").lower().endswith(".zip"):
            await zip_file.close()
            raise HTTPException(400, "Choose a ZIP archive.")
        runner.busy = True
        job_id = store.create()
        path = store.directory / job_id / "upload.zip"
        try:
            total = 0
            with path.open("xb") as output:
                while chunk := await zip_file.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_UPLOAD_BYTES:
                        raise HTTPException(413, "ZIP archives must be at most 50 MB.")
                    output.write(chunk)
            runner.start(job_id, str(path), settings, upload=path)
        except BaseException:
            runner.busy = False
            store.delete(job_id)
            raise
        finally:
            await zip_file.close()
        return {"project_id": job_id}

    def existing_job(job_id: str) -> dict:
        if len(job_id) != 32 or any(character not in "0123456789abcdef" for character in job_id):
            raise HTTPException(404, "Project not found.")
        state = store.get(job_id)
        if not state:
            raise HTTPException(404, "Project not found.")
        return state

    @app.get("/api/v1/projects/{job_id}/status")
    def status(job_id: str):
        return {"project_id": job_id, **existing_job(job_id)}

    @app.get("/api/v1/projects/{job_id}/readme", response_class=PlainTextResponse)
    def readme(job_id: str):
        if existing_job(job_id)["status"] != "ready":
            raise HTTPException(409, "The README is not ready yet.")
        return (store.directory / job_id / "README.md").read_text(encoding="utf-8")

    @app.get("/")
    def index():
        if not (assets / "index.html").is_file():
            raise HTTPException(
                503,
                "Frontend assets are missing. Run 'python scripts/build_frontend.py' in the source checkout.",
            )
        return FileResponse(assets / "index.html")

    if assets.is_dir():
        app.mount("/", StaticFiles(directory=assets, html=True), name="frontend")
    return app
