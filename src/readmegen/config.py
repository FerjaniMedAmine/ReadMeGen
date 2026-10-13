"""Validated preferences; secrets are stored separately from configuration."""

import json
import os
from pathlib import Path
from typing import Literal

from filelock import FileLock
from platformdirs import user_cache_path, user_config_path
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from readmegen.errors import ConfigurationError
from readmegen.storage import write_json

Provider = Literal["gemini", "openai", "anthropic"]


def config_dir() -> Path:
    override = os.environ.get("READMEGEN_HOME")
    return Path(override).expanduser() / "config" if override else user_config_path("readmegen")


def cache_dir() -> Path:
    override = os.environ.get("READMEGEN_HOME")
    return Path(override).expanduser() / "cache" if override else user_cache_path("readmegen")


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    auth_mode: Literal["api-key", "chatgpt"] = "api-key"
    provider: Provider = "gemini"
    model: str = Field(default="", max_length=200, pattern=r"^[^\s]*$")
    profile_id: str | None = None
    max_agents: int = Field(default=8, ge=1, le=8)
    max_agent_files: int = Field(default=12, ge=1, le=12)
    generation_timeout: int = Field(default=900, ge=30, le=3600)

    def require_model(self) -> None:
        if not self.model:
            raise ConfigurationError("Choose a model with 'readmegen setup' or --model.")
        if self.auth_mode == "chatgpt" and self.provider != "openai":
            raise ConfigurationError("ChatGPT sign-in supports OpenAI models only.")


def load_settings() -> Settings:
    path = config_dir() / "settings.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if provider := os.environ.get("READMEGEN_PROVIDER"):
            data["provider"] = provider
        if model := os.environ.get("READMEGEN_MODEL"):
            data["model"] = model
        return Settings.model_validate(data)
    except (OSError, ValueError, ValidationError, TypeError) as error:
        raise ConfigurationError(
            "Invalid preferences. Run 'readmegen setup' to configure again."
        ) from error


def save_settings(settings: Settings) -> None:
    directory = config_dir()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with FileLock(str(directory / "settings.lock")):
        write_json(directory / "settings.json", settings.model_dump())
