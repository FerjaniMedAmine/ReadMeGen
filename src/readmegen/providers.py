"""Provider construction and model discovery outside the generation pipeline."""

import asyncio

import httpx
from langchain_core.language_models import BaseChatModel

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.config import Settings
from readmegen.errors import ConfigurationError


def build_model(
    settings: Settings, credentials: CredentialStore, chatgpt: ChatGPTAuth
) -> BaseChatModel:
    try:
        return _build_model(settings, credentials, chatgpt)
    except ConfigurationError:
        raise
    except Exception as error:
        raise ConfigurationError(
            "Could not initialize this model. Check the provider and model configuration."
        ) from error


def _build_model(
    settings: Settings, credentials: CredentialStore, chatgpt: ChatGPTAuth
) -> BaseChatModel:
    settings.require_model()
    if settings.auth_mode == "chatgpt":
        from readmegen.generation.chatgpt_model import ChatGPTModel

        return ChatGPTModel(
            model=settings.model, token_supplier=lambda: chatgpt.access_token(settings.profile_id)
        )
    key = credentials.api_key(settings.provider)
    if settings.provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.model, api_key=key, temperature=0, max_retries=2, timeout=120
        )
    if settings.provider == "openai":
        from langchain_openai import ChatOpenAI

        # Reasoning models may reject temperature; allow each model's default.
        return ChatOpenAI(model=settings.model, api_key=key, timeout=120, max_retries=2)
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model_name=settings.model, api_key=key, timeout=120, max_retries=2, max_tokens=8192
    )


async def list_models(
    settings: Settings, credentials: CredentialStore, chatgpt: ChatGPTAuth
) -> list[dict]:
    """Fetch a current catalog. Model listing is not an entitlement guarantee."""
    if settings.auth_mode == "chatgpt":
        key = await asyncio.to_thread(chatgpt.access_token, settings.profile_id)
    else:
        key = credentials.api_key(settings.provider)
    if settings.provider == "gemini":
        url, headers = (
            "https://generativelanguage.googleapis.com/v1beta/models",
            {"x-goog-api-key": key},
        )
    elif settings.provider == "anthropic":
        url, headers = (
            "https://api.anthropic.com/v1/models",
            {"x-api-key": key, "anthropic-version": "2023-06-01"},
        )
    else:
        url, headers = "https://api.openai.com/v1/models", {"Authorization": f"Bearer {key}"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
        if settings.auth_mode == "chatgpt":
            return [
                {"id": item["slug"], "name": item.get("display_name", item["slug"])}
                for item in data["models"]
                if item.get("visibility") == "list"
            ]
        if settings.provider == "gemini":
            return [
                {
                    "id": item["name"].removeprefix("models/"),
                    "name": item.get("displayName", item["name"]),
                }
                for item in data.get("models", [])
                if "generateContent" in item.get("supportedGenerationMethods", [])
            ]
        return sorted(
            [
                {"id": item["id"], "name": item.get("display_name", item["id"])}
                for item in data.get("data", [])
            ],
            key=lambda item: item["id"],
        )
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
        raise ConfigurationError(
            "Could not load models. Check your connection and credentials, or enter a compatible model ID."
        ) from error
