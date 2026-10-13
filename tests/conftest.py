import pytest

from readmegen.auth.credentials import CredentialStore


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    monkeypatch.setenv("READMEGEN_HOME", str(tmp_path / "home"))
    for name in [
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "READMEGEN_PROVIDER",
        "READMEGEN_MODEL",
    ]:
        monkeypatch.delenv(name, raising=False)
    # Tests must never inspect or modify a developer's real credential store.
    monkeypatch.setattr("keyring.get_password", lambda *_args: None)
    monkeypatch.setattr("keyring.set_password", lambda *_args: None)
    monkeypatch.setattr("keyring.delete_password", lambda *_args: None)


@pytest.fixture
def credentials():
    store = CredentialStore()
    store.set("api-key:gemini", "test-key", persist=False)
    return store
