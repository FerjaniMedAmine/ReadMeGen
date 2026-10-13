import json
import time
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from readmegen.auth.chatgpt import ISSUER, PLAN_SCOPE, ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.errors import ConfigurationError, GenerationError
from readmegen.generation.chatgpt_model import ChatGPTModel, completed_message, request_body


def test_request_uses_plan_transport_and_replays_tool_and_reasoning_history():
    original = [
        {"type": "reasoning", "id": "reasoning", "encrypted_content": "encrypted", "summary": []},
        {
            "type": "function_call",
            "name": "read_file",
            "namespace": "readmegen",
            "arguments": '{"relative_path":"app.py"}',
            "call_id": "call-1",
            "id": "item-1",
        },
    ]
    response = completed_message({"output": original})
    assert response.tool_calls[0]["name"] == "read_file"
    body = request_body(
        "model",
        [
            SystemMessage("research"),
            HumanMessage("project"),
            response,
            ToolMessage("1: source", tool_call_id="call-1"),
        ],
        [{"type": "function", "name": "read_file"}],
    )
    assert body["store"] is False and body["stream"] is True
    assert body["instructions"] == "research"
    assert body["tools"][0]["type"] == "namespace"
    assert body["input"][1:3] == original
    assert not {"temperature", "previous_response_id", "max_output_tokens"} & body.keys()


@pytest.mark.parametrize("nonce,audience", [("wrong", "client"), ("nonce", "other-client")])
def test_id_token_must_match_nonce_and_issued_client(monkeypatch, nonce, audience):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    jwk.update(kid="test", alg="RS256")
    token = jwt.encode(
        {
            "iss": ISSUER,
            "aud": audience,
            "sub": "account",
            "exp": time.time() + 300,
            "nonce": nonce,
        },
        private,
        algorithm="RS256",
        headers={"kid": "test"},
    )
    responses = iter(
        [
            SimpleNamespace(
                raise_for_status=lambda: None, json=lambda: {"jwks_uri": f"{ISSUER}/jwks"}
            ),
            SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"keys": [jwk]}),
        ]
    )
    monkeypatch.setattr("httpx.get", lambda *_args, **_kwargs: next(responses))
    with pytest.raises(ConfigurationError, match="verify"):
        ChatGPTAuth._verify_identity(token, "client", "nonce")


def test_valid_id_token_is_verified_with_signature(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    jwk.update(kid="test", alg="RS256")
    token = jwt.encode(
        {
            "iss": ISSUER,
            "aud": "client",
            "sub": "account",
            "exp": time.time() + 300,
            "nonce": "nonce",
        },
        private,
        algorithm="RS256",
        headers={"kid": "test"},
    )
    responses = iter(
        [
            SimpleNamespace(
                raise_for_status=lambda: None, json=lambda: {"jwks_uri": f"{ISSUER}/jwks"}
            ),
            SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"keys": [jwk]}),
        ]
    )
    monkeypatch.setattr("httpx.get", lambda *_args, **_kwargs: next(responses))
    assert ChatGPTAuth._verify_identity(token, "client", "nonce")["sub"] == "account"


def test_refresh_preserves_rotating_token_and_uses_issued_client(monkeypatch):
    store = CredentialStore()
    store.set(
        "chatgpt:profile",
        json.dumps(
            {
                "access_token": "old",
                "refresh_token": "refresh",
                "client_id": "issued-client",
                "expires_at": 0,
                "scope": PLAN_SCOPE,
            }
        ),
        persist=False,
    )
    auth = ChatGPTAuth(store)
    auth._session_profiles.add("profile")
    exchange = Mock(
        return_value={
            "access_token": "new",
            "refresh_token": "rotated",
            "token_type": "Bearer",
            "expires_in": 3600,
        }
    )
    monkeypatch.setattr(auth, "_token_request", exchange)
    assert auth.access_token("profile") == "new"
    assert auth.access_token("profile") == "new"
    assert exchange.call_count == 1
    assert exchange.call_args[0][0]["client_id"] == "issued-client"
    assert json.loads(store.get("chatgpt:profile"))["refresh_token"] == "rotated"


def test_identity_without_plan_scope_cannot_run_inference():
    store = CredentialStore()
    store.set(
        "chatgpt:profile",
        json.dumps({"access_token": "token", "expires_at": time.time() + 3600, "scope": "openid"}),
        persist=False,
    )
    with pytest.raises(ConfigurationError, match="plan usage"):
        ChatGPTAuth(store).access_token("profile")


def test_logout_clears_local_tokens_even_when_remote_revocation_fails(monkeypatch):
    store = CredentialStore()
    store.set(
        "chatgpt:profile",
        json.dumps({"refresh_token": "secret", "client_id": "client"}),
        persist=False,
    )
    monkeypatch.setattr("httpx.get", Mock(side_effect=httpx.ConnectError("connection failed")))
    assert ChatGPTAuth(store).logout("profile") is False
    assert store.get("chatgpt:profile") is None


class FakeStream:
    status_code = 200

    def __init__(self, events):
        self.events = events

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def aiter_lines(self):
        for event in self.events:
            yield "data: " + json.dumps(event)
            yield ""


class FakeClient:
    def __init__(self, stream):
        self.response = stream

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    def stream(self, *_args, **_kwargs):
        return self.response


@pytest.mark.parametrize(
    "events",
    [
        [],
        [{"type": "response.output_text.delta", "delta": "partial"}],
        [{"type": "response.failed"}],
        [{"type": "response.incomplete"}],
    ],
)
async def test_interrupted_or_failed_stream_never_returns_partial_output(monkeypatch, events):
    monkeypatch.setattr("httpx.AsyncClient", lambda **_kwargs: FakeClient(FakeStream(events)))
    model = ChatGPTModel(model="model", token_supplier=lambda: "secret")
    with pytest.raises(GenerationError):
        await model.ainvoke("hello")


async def test_complete_stream_returns_document(monkeypatch):
    event = {
        "type": "response.completed",
        "response": {
            "output": [{"type": "message", "content": [{"type": "output_text", "text": "# Demo"}]}]
        },
    }
    monkeypatch.setattr("httpx.AsyncClient", lambda **_kwargs: FakeClient(FakeStream([event])))
    model = ChatGPTModel(model="model", token_supplier=lambda: "secret")
    assert (await model.ainvoke("hello")).content == "# Demo"


def test_loopback_callback_checks_state_and_issued_client(monkeypatch):
    store = CredentialStore()
    auth = ChatGPTAuth(store)
    pending = auth.start(persist=False)
    try:
        assert "client_id=dynamic_agent_client" in pending.url
        assert "code_challenge_method=S256" in pending.url
        invalid = httpx.get(pending.redirect_uri, params={"state": "wrong", "code": "code"})
        assert invalid.status_code == 400
        assert auth.finish(pending.id) is None
        valid = httpx.get(
            pending.redirect_uri,
            params={"state": pending.state, "code": "code", "client_id": "issued-client"},
        )
        assert valid.status_code == 200
        exchange = Mock(
            return_value={
                "id_token": "id",
                "access_token": "token",
                "token_type": "Bearer",
                "scope": PLAN_SCOPE,
                "expires_in": 3600,
            }
        )
        monkeypatch.setattr(auth, "_token_request", exchange)
        monkeypatch.setattr(auth, "_verify_identity", lambda *_args: {"sub": "user", "iss": ISSUER})
        profile_id = auth.finish(pending.id)
        assert exchange.call_args[0][0]["client_id"] == "issued-client"
        assert exchange.call_args[0][0]["redirect_uri"] == pending.redirect_uri
        assert auth.access_token(profile_id) == "token"
        assert "token" not in json.dumps(auth.profiles())
    finally:
        auth.close()
