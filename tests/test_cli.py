from unittest.mock import AsyncMock

import pytest
from typer.testing import CliRunner

from readmegen.cli import app, split_shell_command
from readmegen.config import Settings, save_settings

runner = CliRunner()


def test_cli_help_version_and_noninteractive_default():
    assert runner.invoke(app, ["--version"]).output.strip() == "0.3.0"
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


@pytest.mark.parametrize(
    "command, expected",
    [
        (
            r"/generate C:\Users\Za7lou9\Desktop\sales-analyzer",
            ["/generate", r"C:\Users\Za7lou9\Desktop\sales-analyzer"],
        ),
        (
            '/generate "C:\\Users\\Alice\\My Project\\"',
            ["/generate", "C:\\Users\\Alice\\My Project\\"],
        ),
        (
            r'/generate "C:\My Project" --output="D:\My Docs\README.md"',
            ["/generate", r"C:\My Project", r"--output=D:\My Docs\README.md"],
        ),
        (
            r"/generate \\server\share\project",
            ["/generate", r"\\server\share\project"],
        ),
        ("/generate C:\\", ["/generate", "C:\\"]),
        ('/generate "C:/My Project"', ["/generate", "C:/My Project"]),
        ('/generate ""', ["/generate", ""]),
    ],
)
def test_windows_shell_preserves_paths(command, expected):
    assert split_shell_command(command, windows=True) == expected


def test_posix_shell_keeps_escaped_spaces_and_quotes():
    assert split_shell_command(
        r'/generate /home/alice/My\ Project --output="/tmp/My Docs/README.md"', windows=False
    ) == ["/generate", "/home/alice/My Project", "--output=/tmp/My Docs/README.md"]


def test_shell_selects_windows_path_rules_on_windows(monkeypatch):
    monkeypatch.setattr("readmegen.cli.sys.platform", "win32")
    assert split_shell_command(r"/generate C:\Users\Alice\project") == [
        "/generate",
        r"C:\Users\Alice\project",
    ]


def test_shell_reports_unclosed_quotes():
    with pytest.raises(ValueError, match="No closing quotation"):
        split_shell_command('/generate "C:\\My Project', windows=True)


def test_windows_shell_dispatches_the_original_project_path(monkeypatch):
    from unittest.mock import Mock

    dispatch = Mock()
    monkeypatch.setattr("readmegen.cli.app", dispatch)
    monkeypatch.setattr(
        "readmegen.cli.split_shell_command",
        lambda command: split_shell_command(command, windows=True),
    )
    commands = iter([r"/generate C:\Users\Za7lou9\Desktop\sales-analyzer", "/exit"])
    monkeypatch.setattr("builtins.input", lambda *_args: next(commands))
    result = runner.invoke(app, ["shell"])
    assert result.exit_code == 0, result.output
    dispatch.assert_called_once_with(
        args=["generate", r"C:\Users\Za7lou9\Desktop\sales-analyzer"], standalone_mode=False
    )
