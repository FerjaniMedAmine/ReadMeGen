import httpx
import pytest
from langchain_core.language_models import BaseChatModel

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.config import Settings
from readmegen.errors import ConfigurationError
from readmegen.providers import build_model, list_models


@pytest.mark.parametrize("provider", ["gemini", "openai", "anthropic"])
def test_provider_client_can_bind_scoped_tools_without_inference(provider, monkeypatch):
    from langchain_core.tools import tool

    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "false")
    store = CredentialStore()
    store.set(f"api-key:{provider}", "test-key", persist=False)
    model = build_model(Settings(provider=provider, model="test-model"), store, ChatGPTAuth(store))
    assert isinstance(model, BaseChatModel)

    @tool
    def read_file(path: str) -> str:
        """Read a scoped source file."""
        return path

    assert model.bind_tools([read_file]) is not None


@pytest.mark.parametrize(
    "provider,catalog",
    [
        (
            "gemini",
            {
                "models": [
                    {
                        "name": "models/test-model",
                        "displayName": "Test",
                        "supportedGenerationMethods": ["generateContent"],
                    },
                    {"name": "models/embedding", "supportedGenerationMethods": ["embedContent"]},
                ]
            },
        ),
        ("openai", {"data": [{"id": "test-model"}]}),
        ("anthropic", {"data": [{"id": "test-model", "display_name": "Test"}]}),
    ],
)
async def test_catalogs_use_provider_auth_headers(provider, catalog, monkeypatch):
    store = CredentialStore()
    store.set(f"api-key:{provider}", "test-key", persist=False)
    client_type = httpx.AsyncClient

    def handler(request):
        expected = (
            "x-goog-api-key"
            if provider == "gemini"
            else "x-api-key"
            if provider == "anthropic"
            else "authorization"
        )
        assert request.headers[expected] == (
            "Bearer test-key" if provider == "openai" else "test-key"
        )
        assert "test-key" not in str(request.url)
        return httpx.Response(200, json=catalog)

    monkeypatch.setattr(
        "readmegen.providers.httpx.AsyncClient",
        lambda **kwargs: client_type(transport=httpx.MockTransport(handler), **kwargs),
    )
    models = await list_models(Settings(provider=provider), store, ChatGPTAuth(store))
    assert [item["id"] for item in models] == ["test-model"]


async def test_chatgpt_catalog_uses_account_slugs_and_visibility(monkeypatch):
    store = CredentialStore()
    auth = ChatGPTAuth(store)
    monkeypatch.setattr(auth, "access_token", lambda _profile_id: "test-token")
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "models": [
                    {"slug": "available", "display_name": "Available", "visibility": "list"},
                    {"slug": "hidden", "visibility": "hide"},
                ]
            },
        )
    )
    monkeypatch.setattr(
        "readmegen.providers.httpx.AsyncClient",
        lambda **kwargs: client_type(transport=transport, **kwargs),
    )
    assert await list_models(
        Settings(auth_mode="chatgpt", provider="openai", profile_id="profile"), store, auth
    ) == [{"id": "available", "name": "Available"}]


async def test_catalog_error_does_not_echo_provider_body_or_key(monkeypatch, credentials):
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(
        lambda request: httpx.Response(401, json={"error": "private-test-key"})
    )
    monkeypatch.setattr(
        "readmegen.providers.httpx.AsyncClient",
        lambda **kwargs: client_type(transport=transport, **kwargs),
    )
    with pytest.raises(ConfigurationError) as failure:
        await list_models(Settings(), credentials, ChatGPTAuth(credentials))
    assert "private-test-key" not in str(failure.value)
