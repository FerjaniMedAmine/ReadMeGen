from unittest.mock import AsyncMock

from typer.testing import CliRunner

from readmegen.cli import app
from readmegen.config import Settings, save_settings

runner = CliRunner()


def test_cli_help_version_and_noninteractive_default():
    assert runner.invoke(app, ["--version"]).output.strip() == "0.2.0"
    assert "ui" in runner.invoke(app, ["--help"]).output
    assert "Usage" in runner.invoke(app, []).output


def test_generate_protects_existing_output_before_model_call(tmp_path, monkeypatch):
    output = tmp_path / "README.md"
    output.write_text("existing")
    generate = AsyncMock()
    monkeypatch.setattr("readmegen.cli.generate_document", generate)
    result = runner.invoke(app, ["generate", ".", "--output", str(output)])
    assert result.exit_code == 1
    assert output.read_text() == "existing"
    generate.assert_not_called()


def test_generate_writes_complete_document_and_can_force_replace(tmp_path, monkeypatch):
    save_settings(Settings(model="test-model"))
    monkeypatch.setenv("GOOGLE_API_KEY", "test")
    generate = AsyncMock(return_value="# Generated\n")
    monkeypatch.setattr("readmegen.cli.generate_document", generate)
    output = tmp_path / "README.md"
    for arguments in [[], ["--force"]]:
        result = runner.invoke(
            app, ["generate", str(tmp_path), "--output", str(output), *arguments]
        )
        assert result.exit_code == 0, result.output
        assert output.read_text() == "# Generated\n"
    assert generate.await_count == 2


def test_generate_noninteractive_missing_key_has_actionable_error(tmp_path):
    save_settings(Settings(model="test-model"))
    result = runner.invoke(app, ["generate", str(tmp_path), "-o", str(tmp_path / "README.md")])
    assert result.exit_code == 1
    assert "GOOGLE_API_KEY" in result.output
    assert not (tmp_path / "README.md").exists()


def test_shell_reuses_ui_and_stops_it_on_exit(monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import Mock

    handle = SimpleNamespace(
        url="http://127.0.0.1:1234", thread=SimpleNamespace(is_alive=lambda: True), stop=Mock()
    )
    launch = Mock(return_value=handle)
    monkeypatch.setattr("readmegen.web.server.launch_ui", launch)
    commands = iter(["/ui --no-browser", "/ui", "/exit"])
    monkeypatch.setattr("builtins.input", lambda *_args: next(commands))
    result = runner.invoke(app, ["shell"])
    assert result.exit_code == 0, result.output
    assert launch.call_count == 1
    handle.stop.assert_called_once()
