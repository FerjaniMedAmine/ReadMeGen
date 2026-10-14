import stat
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from readmegen.errors import ImportError
from readmegen.sources import (
    clone_git,
    extract_zip,
    filter_project_files,
    prepare_source,
    validate_git_url,
)


def archive(path: Path, members: dict[str, str]) -> Path:
    with zipfile.ZipFile(path, "w") as stream:
        for name, text in members.items():
            stream.writestr(name, text)
    return path


async def test_prepare_source_accepts_native_directory_with_spaces(tmp_path):
    project = tmp_path / "My Projects" / "sales-analyzer"
    project.mkdir(parents=True)
    (project / "app.py").write_text("print('hello')")
    source = await prepare_source(str(project), tmp_path / "work")
    assert source == project.resolve()
    assert [item.relative_path for item in filter_project_files(source)] == ["app.py"]


async def test_prepare_source_accepts_native_zip_path_with_spaces(tmp_path):
    project = archive(tmp_path / "My Project.zip", {"app.py": "print('hello')"})
    source = await prepare_source(str(project), tmp_path / "work")
    assert (source / "app.py").read_text() == "print('hello')"


def test_filter_prunes_dependencies_credentials_binary_and_symlinks(tmp_path):
    for name, content in {
        "app.py": "print('hello')",
        ".env": "secret",
        ".env.example": "KEY=placeholder",
        "credentials.json": "secret",
        "key.pem": "secret",
        "blob.dat": "\0binary",
        "node_modules/pkg.js": "noise",
    }.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    (tmp_path / "linked.py").symlink_to(tmp_path / "app.py")
    assert {file.relative_path for file in filter_project_files(tmp_path)} == {
        "app.py",
        ".env.example",
    }


@pytest.mark.parametrize(
    "name",
    ["../outside.py", "/outside.py", "C:/outside.py", "demo\\outside.py", "demo/../../outside.py"],
)
def test_zip_rejects_unsafe_paths_before_extracting(tmp_path, name):
    source = archive(tmp_path / "input.zip", {"safe.py": "safe", name: "unsafe"})
    with pytest.raises(ImportError, match="unsafe"):
        extract_zip(source, tmp_path / "source")
    assert not (tmp_path / "source").exists()


def test_zip_rejects_symlink_and_duplicate_paths(tmp_path):
    source = tmp_path / "input.zip"
    with zipfile.ZipFile(source, "w") as stream:
        link = zipfile.ZipInfo("link.py")
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        stream.writestr(link, "../secret")
    with pytest.raises(ImportError):
        extract_zip(source, tmp_path / "source")
    archive(source, {"demo/APP.py": "one", "demo/app.py": "two"})
    with pytest.raises(ImportError, match="duplicate"):
        extract_zip(source, tmp_path / "source")


def test_zip_rejects_empty_and_oversized_archives(tmp_path, monkeypatch):
    source = archive(tmp_path / "input.zip", {"node_modules/pkg.js": "noise"})
    with pytest.raises(ImportError, match="no readable"):
        extract_zip(source, tmp_path / "source")
    archive(source, {"app.py": "123456"})
    monkeypatch.setattr("readmegen.sources.MAX_EXTRACTED_BYTES", 5)
    with pytest.raises(ImportError, match="size limit"):
        extract_zip(source, tmp_path / "source")


def test_zip_nested_project_can_be_analyzed(tmp_path):
    source = archive(
        tmp_path / "input.zip",
        {"demo/app.py": "print('hello')", "demo/.env": "secret", "demo/.git/config": "noise"},
    )
    extract_zip(source, tmp_path / "source")
    assert [file.relative_path for file in filter_project_files(tmp_path / "source")] == [
        "demo/app.py"
    ]


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/a/b",
        "https://evil.test/a/b",
        "https://github.com@evil.test/a/b",
        "https://user:password@github.com/a/b",
        "https://github.com:444/a/b",
        "https://github.com/a/b?token=secret",
        "https://github.com/a/b#main",
        "https://github.com/a",
    ],
)
def test_git_rejects_untrusted_or_credentialed_urls(url):
    with pytest.raises(ImportError):
        validate_git_url(url)


async def test_clone_disables_hooks_prompts_and_inherited_git_config(tmp_path, monkeypatch):
    process = SimpleNamespace(returncode=0, wait=AsyncMock(return_value=0))
    spawn = AsyncMock(return_value=process)
    monkeypatch.setattr("asyncio.create_subprocess_exec", spawn)
    monkeypatch.setenv("GIT_CONFIG_COUNT", "1")
    monkeypatch.setenv("GIT_DIR", "dangerous")
    await clone_git("https://github.com/owner/repo", tmp_path / "source")
    args, kwargs = spawn.call_args
    assert "http.followRedirects=false" in args
    assert "--no-recurse-submodules" in args
    assert kwargs["env"]["GIT_TERMINAL_PROMPT"] == "0"
    assert "GIT_CONFIG_COUNT" not in kwargs["env"]
    assert "GIT_DIR" not in kwargs["env"]
