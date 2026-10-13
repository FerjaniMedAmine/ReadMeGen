"""OS credential storage with explicit, memory-only sessions on headless systems."""

import contextlib
import os

import keyring
from keyring.errors import KeyringError

from readmegen.config import Provider
from readmegen.errors import ConfigurationError

ENVIRONMENT_KEYS: dict[str, tuple[str, ...]] = {
    "gemini": ("GOOGLE_API_KEY", "GEMINI_API_KEY"),
    "openai": ("OPENAI_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY",),
}


class CredentialStore:
    """Never silently fall back to plaintext storage."""

    def __init__(self) -> None:
        self._session: dict[str, str] = {}

    def get(self, name: str) -> str | None:
        if name in self._session:
            return self._session[name]
        try:
            return keyring.get_password("readmegen", name)
        except (KeyringError, RuntimeError):
            return None

    def set(self, name: str, secret: str, *, persist: bool = True) -> None:
        if persist:
            try:
                keyring.set_password("readmegen", name, secret)
            except (KeyringError, RuntimeError) as error:
                raise ConfigurationError(
                    "The OS credential store is unavailable. Use a session-only connection "
                    "or set the provider's API-key environment variable."
                ) from error
            self._session.pop(name, None)
        else:
            self._session[name] = secret

    def delete(self, name: str) -> None:
        self._session.pop(name, None)
        with contextlib.suppress(KeyringError, RuntimeError):
            keyring.delete_password("readmegen", name)

    def api_key(self, provider: Provider) -> str:
        for name in ENVIRONMENT_KEYS[provider]:
            if value := os.environ.get(name):
                return value
        value = self.get(f"api-key:{provider}")
        if not value:
            raise ConfigurationError(
                f"No {provider} API key. Run 'readmegen setup' or set {ENVIRONMENT_KEYS[provider][0]}."
            )
        return value
