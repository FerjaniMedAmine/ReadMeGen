"""Official loopback OAuth/PKCE integration for local open-source installations.

Reference: https://developers.openai.com/siwc/token-sharing-open-source/sign-in
Tokens stay in the OS credential store or this process's memory.
"""

import base64
import hashlib
import json
import secrets
import threading
import time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit
from uuid import uuid4

import httpx
import jwt
from filelock import FileLock

from readmegen.auth.credentials import CredentialStore
from readmegen.config import config_dir
from readmegen.errors import ConfigurationError
from readmegen.storage import write_json

ISSUER = "https://auth.openai.com"
RESOURCE = "https://api.openai.com/v1"
TOKEN_ENDPOINT = f"{ISSUER}/api/accounts/oauth/token"
PLAN_SCOPE = "chatgpt.tokens.use.direct"
LOGIN_TIMEOUT = 300


@dataclass
class PendingLogin:
    id: str
    state: str
    nonce: str
    verifier: str
    redirect_uri: str
    profile: dict | None
    persist: bool
    server: HTTPServer
    url: str = ""
    result: dict[str, str] = field(default_factory=dict)
    completed: threading.Event = field(default_factory=threading.Event)
    expires_at: float = field(default_factory=lambda: time.monotonic() + LOGIN_TIMEOUT)


class ChatGPTAuth:
    def __init__(self, credentials: CredentialStore) -> None:
        self.credentials = credentials
        self._pending: dict[str, PendingLogin] = {}
        self._lock = threading.RLock()
        self._session_profiles: set[str] = set()

    def _metadata(self) -> dict:
        path = config_dir() / "chatgpt.json"
        try:
            return (
                json.loads(path.read_text())
                if path.exists()
                else {"host_id": f"urn:uuid:{uuid4()}", "profiles": {}}
            )
        except (OSError, ValueError) as error:
            raise ConfigurationError("ChatGPT connection metadata is damaged.") from error

    def _save_profile(self, profile_id: str, profile: dict) -> None:
        with self._lock, FileLock(str(config_dir() / "chatgpt.lock")):
            metadata = self._metadata()
            metadata["profiles"][profile_id] = profile
            write_json(config_dir() / "chatgpt.json", metadata)

    def profiles(self) -> list[dict]:
        return [{"id": key, **value} for key, value in self._metadata()["profiles"].items()]

    def start(self, *, profile_id: str | None = None, persist: bool = True) -> PendingLogin:
        config_dir().mkdir(parents=True, exist_ok=True, mode=0o700)
        with self._lock, FileLock(str(config_dir() / "chatgpt.lock")):
            self._expire_pending()
            if self._pending:
                raise ConfigurationError("A ChatGPT sign-in is already in progress.")
            metadata = self._metadata()
            write_json(config_dir() / "chatgpt.json", metadata)
            profile = metadata["profiles"].get(profile_id) if profile_id else None
            if profile_id and not profile:
                raise ConfigurationError("Unknown ChatGPT account. Choose a saved connection.")
            login_id = uuid4().hex
            state, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(3))

            auth = self

            class CallbackHandler(BaseHTTPRequestHandler):
                def do_GET(self) -> None:
                    pending = auth._pending.get(login_id)
                    parsed = urlsplit(self.path)
                    query = parse_qs(parsed.query)
                    valid = (
                        pending is not None
                        and parsed.path == "/auth/callback"
                        and len(query.get("state", [])) == 1
                        and secrets.compare_digest(query["state"][0], state)
                        and not pending.completed.is_set()
                    )
                    if not valid:
                        self.send_error(400, "Invalid sign-in callback")
                        return
                    pending.result = {
                        key: values[0] for key, values in query.items() if len(values) == 1
                    }
                    pending.completed.set()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/plain; charset=utf-8")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Referrer-Policy", "no-referrer")
                    self.end_headers()
                    self.wfile.write(b"Return to ReadMeGen to finish connecting your account.")

                def log_message(self, *_args: Any) -> None:
                    # Callback query strings contain authorization codes.
                    return

            server = HTTPServer(("127.0.0.1", 0), CallbackHandler)
            server.timeout = 0.5
            server.socket.settimeout(2)
            redirect_uri = f"http://127.0.0.1:{server.server_port}/auth/callback"
            pending = PendingLogin(
                login_id, state, nonce, verifier, redirect_uri, profile, persist, server
            )
            parameters = {
                "client_id": profile["client_id"] if profile else "dynamic_agent_client",
                "ext_agent_host_id": metadata["host_id"],
                "response_type": "code",
                "redirect_uri": redirect_uri,
                "scope": f"openid profile email offline_access resource.invoke {PLAN_SCOPE}",
                "resource": RESOURCE,
                "state": state,
                "nonce": nonce,
                "code_challenge_method": "S256",
                "code_challenge": base64.urlsafe_b64encode(
                    hashlib.sha256(verifier.encode()).digest()
                )
                .decode()
                .rstrip("="),
            }
            if not profile:
                parameters["agent_name_hint"] = "ReadMeGen"
            pending.url = f"{ISSUER}/api/accounts/authorize?{urlencode(parameters)}"
            self._pending[login_id] = pending
            threading.Thread(target=self._listen, args=(pending,), daemon=True).start()
            return pending

    @staticmethod
    def _listen(pending: PendingLogin) -> None:
        try:
            while not pending.completed.is_set() and time.monotonic() < pending.expires_at:
                pending.server.handle_request()
        except OSError:
            pass
        finally:
            pending.server.server_close()

    def _expire_pending(self) -> None:
        for login_id, pending in list(self._pending.items()):
            if time.monotonic() >= pending.expires_at:
                pending.completed.set()
                self._pending.pop(login_id)

    def cancel(self, login_id: str) -> None:
        with self._lock:
            if pending := self._pending.pop(login_id, None):
                pending.completed.set()

    def close(self) -> None:
        for login_id in list(self._pending):
            self.cancel(login_id)

    def finish(self, login_id: str) -> str | None:
        with self._lock:
            pending = self._pending.get(login_id)
            if not pending or time.monotonic() >= pending.expires_at:
                self.cancel(login_id)
                raise ConfigurationError("ChatGPT sign-in expired. Start sign-in again.")
            if not pending.completed.is_set():
                return None
            self._pending.pop(login_id)
        result = pending.result
        if "error" in result or not result.get("code"):
            raise ConfigurationError("ChatGPT sign-in was cancelled or denied.")
        client_id = result.get("client_id") or (pending.profile or {}).get("client_id")
        if not client_id or client_id == "dynamic_agent_client":
            raise ConfigurationError("ChatGPT registration did not return a client ID.")
        if pending.profile and client_id != pending.profile["client_id"]:
            raise ConfigurationError("ChatGPT returned a different account registration.")
        tokens = self._token_request(
            {
                "grant_type": "authorization_code",
                "client_id": client_id,
                "code": result["code"],
                "code_verifier": pending.verifier,
                "redirect_uri": pending.redirect_uri,
                "resource": RESOURCE,
            }
        )
        identity = self._verify_identity(tokens.get("id_token", ""), client_id, pending.nonce)
        if pending.profile and (
            identity["sub"] != pending.profile["subject"]
            or identity["iss"] != pending.profile["issuer"]
        ):
            raise ConfigurationError("The signed-in identity does not match the saved connection.")
        if PLAN_SCOPE not in tokens.get("scope", "").split():
            raise ConfigurationError(
                "Sign-in succeeded, but permission to use the ChatGPT plan was not granted."
            )
        profile_id = next(
            (profile["id"] for profile in self.profiles() if profile["client_id"] == client_id),
            uuid4().hex,
        )
        record = {
            **tokens,
            "client_id": client_id,
            "expires_at": time.time() + int(tokens.get("expires_in", 3600)),
        }
        self.credentials.set(f"chatgpt:{profile_id}", json.dumps(record), persist=pending.persist)
        if not pending.persist:
            self._session_profiles.add(profile_id)
        self._save_profile(
            profile_id,
            {
                "client_id": client_id,
                "subject": identity["sub"],
                "issuer": identity["iss"],
                "label": f"{identity.get('email', 'ChatGPT account')} · {client_id[-8:]}",
            },
        )
        return profile_id

    @staticmethod
    def _token_request(data: dict) -> dict:
        try:
            response = httpx.post(TOKEN_ENDPOINT, data=data, timeout=20)
            response.raise_for_status()
            tokens = response.json()
            if not tokens.get("access_token") or tokens.get("token_type", "").lower() != "bearer":
                raise ValueError("Invalid token response")
            return tokens
        except (httpx.HTTPError, ValueError, TypeError) as error:
            raise ConfigurationError(
                "ChatGPT authentication failed. Sign in again or check your connection."
            ) from error

    @staticmethod
    def _verify_identity(token: str, client_id: str, nonce: str) -> dict:
        try:
            discovery = httpx.get(f"{ISSUER}/.well-known/openid-configuration", timeout=15)
            discovery.raise_for_status()
            uri = discovery.json()["jwks_uri"]
            if urlsplit(uri).scheme != "https" or urlsplit(uri).hostname != "auth.openai.com":
                raise ValueError("Unexpected JWKS host")
            response = httpx.get(uri, timeout=15)
            response.raise_for_status()
            header = jwt.get_unverified_header(token)
            key = next(item for item in response.json()["keys"] if item["kid"] == header["kid"])
            identity = jwt.decode(
                token,
                jwt.PyJWK.from_dict(key).key,
                algorithms=["RS256"],
                issuer=ISSUER,
                audience=client_id,
                leeway=30,
                options={"require": ["exp", "iss", "aud", "sub", "nonce"]},
            )
            if not secrets.compare_digest(identity["nonce"], nonce):
                raise ValueError("Invalid nonce")
            return identity
        except (
            httpx.HTTPError,
            jwt.PyJWTError,
            ValueError,
            KeyError,
            TypeError,
            StopIteration,
        ) as error:
            raise ConfigurationError(
                "Could not verify the ChatGPT account identity. Start sign-in again."
            ) from error

    def access_token(self, profile_id: str | None) -> str:
        if not profile_id:
            raise ConfigurationError("Connect a ChatGPT account with 'readmegen setup'.")
        directory = config_dir()
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self._lock, FileLock(str(directory / "chatgpt-refresh.lock"), timeout=30):
            value = self.credentials.get(f"chatgpt:{profile_id}")
            if not value:
                raise ConfigurationError("This ChatGPT session is disconnected. Sign in again.")
            try:
                record = json.loads(value)
                if record["expires_at"] <= time.time() + 60:
                    if not record.get("refresh_token"):
                        raise ConfigurationError("This ChatGPT session expired. Sign in again.")
                    updated = self._token_request(
                        {
                            "grant_type": "refresh_token",
                            "client_id": record["client_id"],
                            "refresh_token": record["refresh_token"],
                            "resource": RESOURCE,
                        }
                    )
                    record.update(updated)
                    record["expires_at"] = time.time() + int(updated.get("expires_in", 3600))
                    self.credentials.set(
                        f"chatgpt:{profile_id}",
                        json.dumps(record),
                        persist=profile_id not in self._session_profiles,
                    )
                if PLAN_SCOPE not in record.get("scope", "").split():
                    raise ConfigurationError("Enable ChatGPT plan usage by signing in again.")
                return record["access_token"]
            except (ValueError, KeyError, TypeError) as error:
                raise ConfigurationError(
                    "The ChatGPT session is invalid. Sign in again."
                ) from error

    def logout(self, profile_id: str) -> bool:
        """Always clear locally; report whether remote revocation was confirmed."""
        confirmed = True
        value = self.credentials.get(f"chatgpt:{profile_id}")
        try:
            if value:
                record = json.loads(value)
                if record.get("refresh_token"):
                    discovery = httpx.get(f"{ISSUER}/.well-known/openid-configuration", timeout=15)
                    discovery.raise_for_status()
                    endpoint = discovery.json()["revocation_endpoint"]
                    if (
                        urlsplit(endpoint).scheme != "https"
                        or urlsplit(endpoint).hostname != "auth.openai.com"
                    ):
                        raise ValueError("Unexpected revocation host")
                    response = httpx.post(
                        endpoint,
                        data={
                            "token": record["refresh_token"],
                            "token_type_hint": "refresh_token",
                            "client_id": record["client_id"],
                        },
                        timeout=15,
                    )
                    confirmed = response.status_code == 200
        except (httpx.HTTPError, ValueError, KeyError):
            confirmed = False
        finally:
            self.credentials.delete(f"chatgpt:{profile_id}")
        return confirmed
